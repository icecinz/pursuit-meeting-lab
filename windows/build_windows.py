"""Build the offline Windows single-file EXE. Requires Zig 0.15.2 or newer."""
from pathlib import Path
import argparse
import hashlib
import os
import shutil
import struct
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
WINDOWS = ROOT / "windows"
VERSION = "1.1.0.0"


def run(arguments, cwd=None):
    subprocess.run([str(value) for value in arguments], cwd=cwd, check=True)


def aligned(data):
    return data + b"\0" * (-len(data) % 4)


def version_pair(text):
    major, minor, patch, build = (int(part) for part in text.split("."))
    return ((major & 0xFFFF) << 16) | (minor & 0xFFFF), ((patch & 0xFFFF) << 16) | (build & 0xFFFF)


def version_text(high, low):
    return f"{high >> 16}.{high & 0xFFFF}.{low >> 16}.{low & 0xFFFF}"


def fixed_versions(version_blob):
    key = "VS_VERSION_INFO\0".encode("utf-16le")
    index = version_blob.find(key)
    if index < 6:
        raise ValueError("Missing VS_VERSION_INFO")
    _, value_length, kind = struct.unpack_from("<HHH", version_blob, index - 6)
    if kind != 0 or value_length < 52:
        raise ValueError("Unexpected version resource header")
    value_at = (index + len(key) + 3) & ~3
    fields = struct.unpack_from("<13I", version_blob, value_at)
    if fields[0] != 0xFEEF04BD:
        raise ValueError("Bad VS_FIXEDFILEINFO signature")
    return version_text(fields[2], fields[3]), version_text(fields[4], fields[5])


def version_string(version_blob, name):
    key = (name + "\0").encode("utf-16le")
    index = version_blob.find(key)
    if index < 0:
        raise ValueError(f"Missing version string {name}")
    value_at = (index + len(key) + 3) & ~3
    chars = []
    while value_at + 1 < len(version_blob):
        code = struct.unpack_from("<H", version_blob, value_at)[0]
        value_at += 2
        if code == 0:
            break
        chars.append(chr(code))
    return "".join(chars)


def version_block(key, value=b"", value_length=0, kind=1, children=()):
    body = aligned(b"\0" * 6 + (key + "\0").encode("utf-16le")) + value
    for child in children:
        body = aligned(body) + child
    return struct.pack("<HHH", len(body), value_length, kind) + body[6:]


def version_info():
    strings = {
        "FileDescription": "追及与相遇演示",
        "ProductName": "追及与相遇演示",
        "FileVersion": VERSION,
        "OriginalFilename": "追及与相遇演示.exe",
    }
    values = []
    for key, text in strings.items():
        encoded = (text + "\0").encode("utf-16le")
        values.append(version_block(key, encoded, len(encoded) // 2))
    table = version_block("080404B0", children=values)
    string_info = version_block("StringFileInfo", children=[table])
    translation = version_block("Translation", struct.pack("<HH", 0x0804, 1200), 4, 0)
    variable_info = version_block("VarFileInfo", children=[translation])
    file_ms, file_ls = version_pair(VERSION)
    fixed = struct.pack("<13I", 0xFEEF04BD, 0x10000, file_ms, file_ls,
                        file_ms, file_ls, 0x3F, 0, 0x40004, 1, 0, 0, 0)
    return version_block("VS_VERSION_INFO", fixed, len(fixed), 0,
                         [string_info, variable_info])


def resource_record(kind, name, payload, language=0x0804):
    identifiers = struct.pack("<4H", 0xFFFF, kind, 0xFFFF, name)
    details = struct.pack("<IHHII", 0, 0x1030 if payload else 0, language, 0, 0)
    header = struct.pack("<II", len(payload), 8 + len(identifiers) + len(details))
    return aligned(header + identifiers + details + payload)


def write_resources(path, page, manifest):
    # The standard .res format is small and platform-independent. Generating
    # it here avoids a host SDK or Windows resource compiler dependency.
    path.write_bytes(resource_record(0, 0, b"", 0) +
                     resource_record(24, 1, manifest) +
                     resource_record(10, 101, page) +
                     resource_record(16, 1, version_info()))


def resource_payload(executable, kind, name):
    """Read a numeric PE resource directly, without platform-specific tools."""
    data = executable.read_bytes()
    pe = struct.unpack_from("<I", data, 0x3C)[0]
    if data[pe:pe + 4] != b"PE\0\0":
        raise ValueError("Not a Windows PE executable")
    machine, count, _, _, _, optional_size, _ = struct.unpack_from("<HHIIIHH", data, pe + 4)
    optional = pe + 24
    if machine != 0x8664 or struct.unpack_from("<H", data, optional)[0] != 0x20B:
        raise ValueError("Expected a Windows x86-64 PE32+ executable")
    if struct.unpack_from("<H", data, optional + 68)[0] != 2:
        raise ValueError("Expected a GUI executable without a console window")
    sections = []
    for index in range(count):
        offset = optional + optional_size + index * 40
        virtual_size, virtual_address, raw_size, raw_offset = struct.unpack_from("<IIII", data, offset + 8)
        sections.append((virtual_address, max(virtual_size, raw_size), raw_offset))

    def offset_for(rva):
        for address, size, raw in sections:
            if address <= rva < address + size:
                return raw + rva - address
        raise ValueError("PE address lies outside its sections")

    resource_rva, resource_size = struct.unpack_from("<II", data, optional + 112 + 2 * 8)
    if not resource_rva or not resource_size:
        raise ValueError("Missing embedded resources")
    base = offset_for(resource_rva)

    def entries(relative):
        directory = base + relative
        named, numbered = struct.unpack_from("<HH", data, directory + 12)
        return [struct.unpack_from("<II", data, directory + 16 + index * 8)
                for index in range(named + numbered)]

    directory = 0
    for identifier in (kind, name):
        match = next((value for key, value in entries(directory) if key == identifier), None)
        if match is None or not match & 0x80000000:
            raise ValueError(f"Missing resource {kind}/{name}")
        directory = match & 0x7FFFFFFF
    languages = entries(directory)
    if not languages or languages[0][1] & 0x80000000:
        raise ValueError("Invalid resource language entry")
    resource = base + languages[0][1]
    rva, size = struct.unpack_from("<II", data, resource)
    start = offset_for(rva)
    return data[start:start + size]


def verify(executable, html):
    page = html.read_bytes()
    if resource_payload(executable, 10, 101) != page:
        raise ValueError("Embedded HTML differs from the current offline page")
    manifest = resource_payload(executable, 24, 1)
    if b'level="asInvoker"' not in manifest or b'requireAdministrator' in manifest:
        raise ValueError("The launcher must use normal user permissions")
    version = resource_payload(executable, 16, 1)
    file_version, product_version = fixed_versions(version)
    file_version_text = version_string(version, "FileVersion")
    manifest_version = f'version="{VERSION}"'.encode()
    if (file_version, product_version, file_version_text) != (VERSION, VERSION, VERSION) or manifest_version not in manifest:
        raise ValueError(
            f"Expected Windows version {VERSION}; "
            f"file {file_version}, product {product_version}, string {file_version_text}"
        )
    print(f"Verified: x86-64 Windows GUI, embedded HTML matches, normal user manifest, version {VERSION}.")
    print("HTML SHA-256:", hashlib.sha256(page).hexdigest())
    print("EXE SHA-256:", hashlib.sha256(executable.read_bytes()).hexdigest())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zig", default=os.environ.get("ZIG") or shutil.which("zig"),
                        help="Path to the official Zig compiler")
    parser.add_argument("--output", type=Path, default=WINDOWS / "dist" / "追及与相遇演示.exe")
    parser.add_argument("--verify-only", type=Path, help="Verify an existing EXE against dist/index.html")
    arguments = parser.parse_args()
    html = ROOT / "dist" / "index.html"
    if arguments.verify_only:
        verify(arguments.verify_only.resolve(), html)
        return
    if not arguments.zig:
        parser.error("Install the official Zig compiler, or pass --zig /absolute/path/to/zig")
    compiler = Path(arguments.zig).expanduser().resolve()
    if not compiler.is_file():
        parser.error(f"Zig not found: {compiler}")
    run([sys.executable, ROOT / "build.py"], cwd=ROOT)
    page = html.read_bytes()
    if b"<script src=" in page or b'<link rel="stylesheet"' in page:
        raise ValueError("The offline page still references external code or styles")
    output = arguments.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="motion-windows-build-") as temporary:
        build = Path(temporary)
        resource = build / "launcher.res"
        write_resources(resource, page, (WINDOWS / "launcher.manifest").read_bytes())
        candidate = build / "motion.exe"
        run([compiler, "cc", "-target", "x86_64-windows-gnu", "-std=c11", "-O2", "-s",
             "-municode", "-Wl,--subsystem,windows", "-Wall", "-Wextra", "-Werror",
             WINDOWS / "launcher.c", resource, "-lshell32", "-lshlwapi", "-ladvapi32",
             "-luser32", "-o", candidate], cwd=build)
        verify(candidate, html)
        shutil.copy2(candidate, output)
    print("Windows single-file EXE:", output)


if __name__ == "__main__":
    main()
