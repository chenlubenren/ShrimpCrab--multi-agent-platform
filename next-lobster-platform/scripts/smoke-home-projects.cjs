const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function countMatches(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}

function assertOrdered(source, labels, message) {
  let cursor = -1;
  for (const label of labels) {
    const next = source.indexOf(label, cursor + 1);
    assert(next !== -1, `${message}: missing ${label}`);
    assert(next > cursor, `${message}: ${label} is out of order`);
    cursor = next;
  }
}

const home = read('src/app/page.tsx');
const projects = read('src/app/projects/page.tsx');
const store = read('src/store/useStore.ts');
const api = read('src/lib/api.ts');
const types = read('src/types/index.ts');

assert(!home.includes('参考模板'), 'Homepage must not show the old reference-template entry.');
assert(home.includes('const recentProjects = projects.slice(0, 4);'), 'Homepage must cap recent projects to four cards.');
assert(countMatches(home, /projects\.slice\(0,\s*4\)/g) >= 2, 'Both desktop and mobile home should cap recent projects to four.');
assert(home.includes('function ProjectCard'), 'Homepage must render recent project cards.');
assert(home.includes('title="我的项目"'), 'Homepage must include 我的项目 menu card.');
assert(home.includes('title="我的团队"'), 'Homepage must include 我的团队 menu card.');

const desktopSectionIndex = home.indexOf('<SectionB>');
assert(desktopSectionIndex !== -1, 'Desktop SectionB was not found.');
const desktopSection = home.slice(desktopSectionIndex);
assertOrdered(
  desktopSection,
  ['href="/architectures/create"', 'href="/architectures/mine"', 'href="/projects"', 'href="/agent-tea-party"'],
  'Desktop right-side menu order'
);
assertOrdered(
  desktopSection,
  ['title="创建团队"', 'title="我的团队"', 'title="我的项目"', 'title="Agent 茶话会"'],
  'Desktop right-side menu labels'
);

assert(home.includes('MobileProjectRow'), 'Mobile homepage must render project rows.');
assert(home.includes('activeTab === \'projects\''), 'Mobile homepage must have a 我的项目 tab panel.');
assert(home.includes('href="/agent-tea-party"'), 'Homepage must expose Agent 茶话会 from project/team surfaces.');

for (const required of [
  'export interface Project',
  'workspacePath: string',
  'teamIds: string[]',
  'ganttEnabled: boolean',
  'ganttPlan: ProjectGanttItem[]',
  'gitRemote: string',
  'gitBranch: string',
  'gitCommit: string',
  'export interface ProjectInput',
]) {
  assert(types.includes(required), `Project type missing ${required}`);
}

for (const required of [
  'fetchProjects',
  'createProjectAPI',
  'updateProjectAPI',
  'openProjectAPI',
  'deleteProjectAPI',
]) {
  assert(store.includes(required), `Store project action missing ${required}`);
}

for (const required of [
  'fetchProjects',
  'createProject',
  'updateProject',
  'openProject',
  'deleteProject',
  '/api/projects',
]) {
  assert(api.includes(required), `API project helper missing ${required}`);
}

for (const required of [
  'PROJECT_ICON_OPTIONS',
  'ProjectIconPicker',
  'ProjectGanttEditor',
  '项目名称',
  '项目简介',
  '备注',
  'Git 分支',
  'Git 版本',
  'Git 远端',
  '绑定团队',
  '服务器工作空间',
  'ganttEnabled',
  'ganttPlan',
  'gitRemote',
  'gitBranch',
  'gitCommit',
  'teamIds',
]) {
  assert(projects.includes(required), `Projects page missing ${required}`);
}

console.log(JSON.stringify({
  homeProjectsVerified: true,
  recentProjectCap: 4,
  desktopMenuOrder: ['创建团队', '我的团队', '我的项目', 'Agent 茶话会'],
  projectFields: [
    'name',
    'description',
    'notes',
    'icon',
    'teamIds',
    'ganttPlan',
    'gitRemote',
    'gitBranch',
    'gitCommit',
  ],
}, null, 2));
