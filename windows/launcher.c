/* A portable Windows launcher; the complete offline page lives in RCDATA 101. */
#ifndef UNICODE
#define UNICODE 1
#endif
#ifndef _UNICODE
#define _UNICODE 1
#endif
#define WIN32_LEAN_AND_MEAN
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <strsafe.h>

#define PAGE_RESOURCE 101
#define PATH_CAP 32768

static const WCHAR APP_TITLE[] = L"追及与相遇演示";

static BOOL regular_file(const WCHAR *path) {
    DWORD attributes = GetFileAttributesW(path);
    return attributes != INVALID_FILE_ATTRIBUTES && !(attributes & FILE_ATTRIBUTE_DIRECTORY);
}

static void report_error(const WCHAR *message) {
    MessageBoxW(NULL, message, APP_TITLE, MB_OK | MB_ICONERROR);
}

static BOOL page_matches(const WCHAR *path, const BYTE *page, DWORD length) {
    HANDLE file = CreateFileW(path, GENERIC_READ,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, NULL, OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL, NULL);
    if (file == INVALID_HANDLE_VALUE) return FALSE;
    LARGE_INTEGER size;
    BOOL same = GetFileSizeEx(file, &size) && size.QuadPart == length;
    BYTE buffer[8192];
    DWORD offset = 0;
    while (same && offset < length) {
        DWORD count = length - offset, read = 0;
        if (count > sizeof(buffer)) count = sizeof(buffer);
        same = ReadFile(file, buffer, count, &read, NULL) && read == count;
        for (DWORD i = 0; same && i < count; ++i) same = buffer[i] == page[offset + i];
        offset += count;
    }
    CloseHandle(file);
    return same;
}

static BOOL cache_page(const BYTE *page, DWORD length, WCHAR *path) {
    WCHAR folder[PATH_CAP], temporary[PATH_CAP];
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA | CSIDL_FLAG_CREATE,
                               NULL, SHGFP_TYPE_CURRENT, folder))) return FALSE;
    if (FAILED(StringCchCatW(folder, PATH_CAP, L"\\ZhuiJiYuXiangYu"))) return FALSE;
    if (!CreateDirectoryW(folder, NULL) && GetLastError() != ERROR_ALREADY_EXISTS) return FALSE;
    if (FAILED(StringCchPrintfW(path, PATH_CAP, L"%s\\motion.html", folder))) return FALSE;
    if (page_matches(path, page, length)) return TRUE;

    // Write next to the destination, then atomically replace it. Concurrent
    // launches and interrupted writes cannot leave a half-written page.
    if (!GetTempFileNameW(folder, L"zjy", 0, temporary)) return FALSE;
    HANDLE file = CreateFileW(temporary, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS,
                              FILE_ATTRIBUTE_NORMAL, NULL);
    if (file == INVALID_HANDLE_VALUE) {
        DeleteFileW(temporary);
        return FALSE;
    }
    DWORD written = 0;
    BOOL complete = WriteFile(file, page, length, &written, NULL) && written == length;
    if (complete) complete = FlushFileBuffers(file);
    if (!CloseHandle(file)) complete = FALSE;
    if (complete) complete = MoveFileExW(temporary, path,
                                        MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH);
    if (!complete) DeleteFileW(temporary);
    return complete;
}

static BOOL app_path(HKEY root, const WCHAR *name, WCHAR *browser) {
    WCHAR key[256];
    if (FAILED(StringCchPrintfW(key, 256,
            L"Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\%s", name))) return FALSE;
    DWORD bytes = PATH_CAP * sizeof(WCHAR);
    return RegGetValueW(root, key, NULL, RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ,
                        NULL, browser, &bytes) == ERROR_SUCCESS && regular_file(browser);
}

static BOOL edge_path(WCHAR *browser) {
    if (app_path(HKEY_CURRENT_USER, L"msedge.exe", browser) ||
        app_path(HKEY_LOCAL_MACHINE, L"msedge.exe", browser)) return TRUE;
    const WCHAR *variables[] = {L"ProgramFiles(x86)", L"ProgramFiles", L"LOCALAPPDATA"};
    for (DWORD i = 0; i < sizeof(variables) / sizeof(variables[0]); ++i) {
        WCHAR base[PATH_CAP];
        DWORD count = GetEnvironmentVariableW(variables[i], base, PATH_CAP);
        if (count && count < PATH_CAP && SUCCEEDED(StringCchPrintfW(browser, PATH_CAP,
                L"%s\\Microsoft\\Edge\\Application\\msedge.exe", base)) && regular_file(browser)) return TRUE;
    }
    return FALSE;
}

static BOOL launch_browser(const WCHAR *browser, const WCHAR *url) {
    WCHAR parameters[PATH_CAP];
    const WCHAR *name = PathFindFileNameW(browser);
    BOOL chromium = !lstrcmpiW(name, L"msedge.exe") || !lstrcmpiW(name, L"chrome.exe") ||
                    !lstrcmpiW(name, L"chromium.exe") || !lstrcmpiW(name, L"brave.exe");
    // Chromium can open a clean app window. Other default browsers receive
    // an ordinary file URL instead of unsupported Chromium command flags.
    HRESULT result = chromium
        ? StringCchPrintfW(parameters, PATH_CAP, L"--app=\"%s\" --start-maximized", url)
        : StringCchPrintfW(parameters, PATH_CAP, L"\"%s\"", url);
    if (FAILED(result)) return FALSE;
    return (INT_PTR)ShellExecuteW(NULL, L"open", browser, parameters, NULL, SW_SHOWMAXIMIZED) > 32;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR command, int show) {
    (void)previous; (void)command; (void)show;
    HRSRC resource = FindResourceW(instance, MAKEINTRESOURCEW(PAGE_RESOURCE), RT_RCDATA);
    HGLOBAL loaded = resource ? LoadResource(instance, resource) : NULL;
    const BYTE *page = loaded ? (const BYTE *)LockResource(loaded) : NULL;
    DWORD length = resource ? SizeofResource(instance, resource) : 0;
    if (!page || !length) {
        report_error(L"演示内容未能读取，请重新获取完整的演示文件。");
        return 1;
    }

    WCHAR path[PATH_CAP], url[PATH_CAP], browser[PATH_CAP];
    if (!cache_page(page, length, path)) {
        report_error(L"无法准备演示内容。请确认当前账户的本地文件夹可写，并留有可用空间。");
        return 1;
    }
    DWORD url_length = PATH_CAP;
    if (FAILED(UrlCreateFromPathW(path, url, &url_length, 0))) {
        report_error(L"演示文件路径无法打开，请尝试使用较短的 Windows 用户文件夹路径。");
        return 1;
    }

    // Resolve the HTTPS browser, rather than .html: HTML files may be
    // associated with an editor even when the normal browser is installed.
    DWORD browser_length = PATH_CAP;
    if (SUCCEEDED(AssocQueryStringW(ASSOCF_IS_PROTOCOL, ASSOCSTR_EXECUTABLE,
            L"https", L"open", browser, &browser_length)) && regular_file(browser) &&
            launch_browser(browser, url)) return 0;
    if (edge_path(browser) && launch_browser(browser, url)) return 0;

    report_error(L"未找到可用的网页浏览器。请安装或设置 Microsoft Edge、Chrome 等浏览器后重试。");
    return 1;
}
