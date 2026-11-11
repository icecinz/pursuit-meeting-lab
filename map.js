(() => {
  'use strict';
  const trigger = document.getElementById('map-open');
  if (!trigger || !window.Presets) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'classification-map';
  dialog.setAttribute('aria-labelledby', 'classification-map-title');
  dialog.setAttribute('aria-describedby', 'classification-map-description');
  dialog.innerHTML = '<div class="map-top"><div><span class="map-kicker">CLASSIFICATION MAP</span><h2 id="classification-map-title">追及与相遇分类图谱</h2><p id="classification-map-description">从不同线索查看运动情境。同一个情境可以出现在多个分类中。</p></div><button type="button" class="map-close" aria-label="关闭分类图谱">×</button></div><div class="map-content"></div>';
  document.body.appendChild(dialog);
  const content = dialog.querySelector('.map-content');
  dialog.querySelector('.map-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  const dimensions = {
    pursuit: ['group', 'initial', 'advantage', 'process', 'result'],
    meeting: ['group', 'advantage', 'phase', 'process', 'result']
  };
  const dimensionNotes = {
    group: '两物体分别怎样运动',
    initial: '开始时谁的速度更大',
    advantage: '两者速度差如何变化',
    process: '间距或运动过程如何变化',
    phase: '相遇与停车的先后',
    result: '在展示时间内的结果'
  };
  const headings = {
    pursuit: ['同向追及', 'A 在后，B 在前，初始时同向运动'],
    meeting: ['相向相遇', '两物体初始时朝彼此运动']
  };

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function orderedValues(scope, field, values) {
    const labels = window.Presets.labels;
    const preferred = field === 'group' ? [] :
      (field === 'process' || field === 'result') ? (labels[field] || []) :
      ((labels[scope] || {})[field] || []);
    return [...preferred.filter(value => values.includes(value)), ...values.filter(value => !preferred.includes(value))];
  }

  function go(scope, dimension, category) {
    const scopeButton = document.querySelector(`[data-scope="${scope}"]`);
    if (!scopeButton) return;
    scopeButton.click();
    if (scope !== 'general') {
      const dimensionSelect = document.getElementById('dimension');
      const categorySelect = document.getElementById('category');
      dimensionSelect.value = dimension;
      dimensionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      categorySelect.value = category;
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    dialog.close();
  }

  function dimensionBranch(scope, field, items, current) {
    const branch = node('details', 'map-dimension');
    const summary = node('summary', 'map-dimension-summary');
    const labels = window.Presets.labels.fields;
    const name = scope === 'meeting' && field === 'advantage' ? '按靠近速度变化分' : labels[field];
    const heading = node('span', 'map-dimension-title', name);
    const note = node('span', 'map-dimension-note', field === 'advantage' && scope === 'meeting' ? '靠近速度如何变化' : dimensionNotes[field]);
    const categoryValues = orderedValues(scope, field, [...new Set(items.map(item => item[field]).filter(Boolean))]);
    const count = node('span', 'map-dimension-count', `${categoryValues.length} 类`);
    summary.append(heading, note, count);
    branch.appendChild(summary);

    const leaves = node('div', 'map-leaves');
    for (const value of categoryValues) {
      const matching = items.filter(item => item[field] === value).length;
      const leaf = node('button', 'map-leaf');
      leaf.type = 'button';
      leaf.title = `查看“${value}”中的演示情境`;
      if (current.scope === scope && current.dimension === field && current.category === value) {
        leaf.classList.add('is-current');
        leaf.setAttribute('aria-current', 'true');
      }
      leaf.append(node('span', 'map-leaf-name', value), node('span', 'map-leaf-count', `${matching} 个情境`));
      leaf.addEventListener('click', () => go(scope, field, value));
      leaves.appendChild(leaf);
    }
    branch.appendChild(leaves);
    return branch;
  }

  function scopeBranch(scope, allItems, current) {
    const items = allItems.filter(item => item.scope === scope);
    const [name, note] = headings[scope];
    const branch = node('details', 'map-scope');
    branch.open = true;
    const summary = node('summary', 'map-scope-summary');
    const description = node('span', 'map-scope-description');
    description.append(node('strong', 'map-scope-title', name), node('span', 'map-scope-note', note));
    summary.append(description, node('span', 'map-scope-count', `${items.length} 个演示情境`));
    branch.appendChild(summary);
    const branches = node('div', 'map-dimensions');
    dimensions[scope].forEach(field => branches.appendChild(dimensionBranch(scope, field, items, current)));
    branch.appendChild(branches);
    return branch;
  }

  function render() {
    const showUniform = document.getElementById('show-uniform')?.checked !== false;
    const allItems = window.Presets.list.filter(item => showUniform || !(item.scope === 'pursuit' && item.group === '匀速追匀速'));
    const selectedScope = document.querySelector('.scope-tabs button.selected');
    const current = {
      scope: selectedScope?.dataset.scope || '',
      dimension: document.getElementById('dimension')?.value || '',
      category: document.getElementById('category')?.value || ''
    };
    content.replaceChildren();
    const root = node('div', 'map-root');
    root.append(node('span', 'map-root-eyebrow', '直线运动'), node('strong', 'map-root-title', '追及与相遇'));
    content.appendChild(root);
    const tree = node('div', 'map-tree');
    tree.append(scopeBranch('pursuit', allItems, current), scopeBranch('meeting', allItems, current));
    const general = node('button', 'map-general');
    general.type = 'button';
    const generalText = node('span', 'map-general-description');
    generalText.append(node('strong', 'map-general-title', '通用模式'), node('span', 'map-general-note', '自由设置两物体的位置、速度和加速度'));
    general.append(generalText, node('span', 'map-general-action', '进入 →'));
    if (current.scope === 'general') general.classList.add('is-current');
    general.addEventListener('click', () => go('general'));
    tree.appendChild(general);
    content.appendChild(tree);
    const foot = node('p', 'map-foot', '数字表示该分类下的预设情境数量。点击任一分类，可回到演示并查看。');
    content.appendChild(foot);
  }

  trigger.addEventListener('click', () => {
    render();
    dialog.showModal();
    content.scrollTop = 0;
  });
})();
