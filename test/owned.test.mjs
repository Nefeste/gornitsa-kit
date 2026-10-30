import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ownedFiles, ownedPatterns } from '../actions/automerge/owned.mjs';

const CODEOWNERS = `# пути владельца
/.github/ @Nefeste
/app.json @Nefeste
/src/money/ @Nefeste
store/forms.md @Nefeste
/deploy/**/*.sh @Nefeste
`;

test('пути владельца: папка, файл от корня, «/» в середине — тоже от корня, ** через папки', () => {
  const p = ownedPatterns(CODEOWNERS);
  assert.deepEqual(ownedFiles([
    '.github/workflows/pr.yml', 'app.json', 'app.json.bak', 'src/money/rustore.ts', 'src/moneybox.ts',
    'store/forms.md', 'other/store/forms.md', 'deploy/a/b/run.sh', 'deploy/run.sh', 'docs/README.md',
  ], p), ['.github/workflows/pr.yml', 'app.json', 'src/money/rustore.ts', 'store/forms.md', 'deploy/a/b/run.sh', 'deploy/run.sh']);
  // шаблон без «/» — где угодно, как у GitHub
  assert.deepEqual(ownedFiles(['a/b/LICENSE', 'LICENSE'], ownedPatterns('LICENSE @Nefeste\n')), ['a/b/LICENSE', 'LICENSE']);
});

test('строка без владельца и непонятный шаблон — ошибка, а не тихий пропуск', () => {
  assert.throws(() => ownedPatterns('/docs/\n'), /нет владельца/);
  assert.throws(() => ownedPatterns('/src/[ab].ts @Nefeste\n'), /не поддерживается/);
});
