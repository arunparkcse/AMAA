#!/usr/bin/env node
/**
 *  FULL-STACK CODE GENERATOR
 *  -------------------------------------------------
 *  One JSON schema → Docker + Terraform + Ngx-Admin
 *  -------------------------------------------------
 *  npm i fs-extra ejs commander
 *  node generator.js --schema schema.json --output my-app
 */

const fs = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const { program } = require('commander');

program
  .option('-s, --schema <path>', 'Path to schema JSON', 'schema.json')
  .option('-o, --output <dir>', 'Output directory', 'my-app')
  .option('--graphql', 'Enable GraphQL', false)
  .option('--docker', 'Enable Docker', true)
  .option('--ci', 'Enable GitHub CI/CD', true)
  .option('--terraform', 'Enable AWS Terraform', true)
  .option('--admin', 'Enable Ngx-Admin panel', true)
  .parse();

const opts = program.opts();
const schemaPath = path.resolve(opts.schema);
const outDir = path.resolve(opts.output);
const enableGraphQL = opts.graphql;
const enableDocker = opts.docker;
const enableCI = opts.ci;
const enableTerraform = opts.terraform;
const enableAdmin = opts.admin;

if (!fs.existsSync(schemaPath)) {
  console.error(`Schema not found: ${schemaPath}`);
  process.exit(1);
}
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const {
  projectName,
  database = 'postgres',
  dbDev = 'sqlite',
  dbTest = 'sqlite',
  authEntity,
  entities = [],
  graphql = enableGraphQL,
  docker = enableDocker,
  ci = enableCI,
  terraform = enableTerraform,
  adminPanel = enableAdmin,
} = schema;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const toPascal = s => s.replace(/(^\w|-\w)/g, c => c.replace('-', '').toUpperCase());
const toCamel  = s => s[0].toLowerCase() + toPascal(s).slice(1);
const toKebab  = s => s.replace(/([A-Z])/g, '-$1').toLowerCase();

async function render(src, dest, data = {}) {
  const tmpl = path.join(__dirname, 'templates', src);
  const content = await ejs.renderFile(tmpl, { ...data, toPascal, toCamel, toKebab, schema }, { async: true });
  fs.outputFileSync(dest, content);
}

// ---------------------------------------------------------------------
// Folder skeleton
// ---------------------------------------------------------------------
fs.emptyDirSync(outDir);
const BACK = path.join(outDir, 'backend');
const FRONT = path.join(outDir, 'frontend');
const dirs = [
  `${BACK}/src/models`,
  `${BACK}/src/controllers`,
  `${BACK}/src/routes`,
  `${BACK}/src/middleware`,
  `${BACK}/src/graphql`,
  `${BACK}/tests`,
  `${BACK}/uploads`,
  `${FRONT}/src/app/core`,
  `${FRONT}/src/app/features`,
  `${FRONT}/src/app/shared`,
];
if (adminPanel) dirs.push(`${FRONT}/src/app/@theme/layouts`, `${FRONT}/src/app/pages`);
if (terraform) dirs.push(`${outDir}/terraform`);
dirs.forEach(d => fs.ensureDirSync(d));

// ---------------------------------------------------------------------
// ROOT files (Docker, CI, Terraform)
// ---------------------------------------------------------------------
if (docker) {
  render('docker/Dockerfile.backend', `${BACK}/Dockerfile`, { schema });
  render('docker/Dockerfile.frontend', `${FRONT}/Dockerfile`, { schema });
  render('docker/docker-compose.yml', `${outDir}/docker-compose.yml`, { schema });
}
if (ci) {
  render('ci/github-workflow.yml', `${outDir}/.github/workflows/ci.yml`, { schema });
}
if (terraform) {
  render('terraform/main.tf', `${outDir}/terraform/main.tf`, { schema });
  render('terraform/variables.tf', `${outDir}/terraform/variables.tf`, { schema });
  render('terraform/outputs.tf', `${outDir}/terraform/outputs.tf`, { schema });
  render('terraform/terraform.tfvars.example', `${outDir}/terraform/terraform.tfvars.example`, { schema });
}

// ---------------------------------------------------------------------
// BACKEND
// ---------------------------------------------------------------------
render('backend/package.json.ejs', `${BACK}/package.json`, { schema });
render('backend/tsconfig.json.ejs', `${BACK}/tsconfig.json`, {});
render('backend/.env.example', `${BACK}/.env.example`, { schema });
render('backend/src/server.ts.ejs', `${BACK}/src/server.ts`, { schema });

render('backend/src/config/database.ts.ejs', `${BACK}/src/config/database.ts`, { schema });
render('backend/src/middleware/auth.ts.ejs', `${BACK}/src/middleware/auth.ts`, { schema });
render('backend/src/middleware/upload.ts.ejs', `${BACK}/src/middleware/upload.ts`, { schema });
render('backend/src/middleware/error.ts.ejs', `${BACK}/src/middleware/error.ts`, { schema });
render('backend/src/routes/auth.ts.ejs', `${BACK}/src/routes/auth.ts`, { schema });

// Models + migrations + tests
for (const ent of entities) {
  render('backend/src/models/model.ts.ejs', `${BACK}/src/models/${ent.name}.ts`, { ent, schema });
  render('backend/migrations/create-table.ts.ejs', `${BACK}/migrations/${Date.now()}-create-${ent.tableName}.ts`, { ent, schema });
  render('backend/tests/model.test.ts.ejs', `${BACK}/tests/${ent.name}.test.ts`, { ent, schema });
}

// Controllers + routes
for (const ent of entities) {
  const name = ent.name;
  const kebab = toKebab(name);
  render('backend/src/controllers/controller.ts.ejs', `${BACK}/src/controllers/${name}Controller.ts`, { ent, schema });
  render('backend/src/routes/route.ts.ejs', `${BACK}/src/routes/${kebab}.ts`, { ent, schema });
}
render('backend/src/routes/index.ts.ejs', `${BACK}/src/routes/index.ts`, { entities, schema });

if (graphql) {
  render('backend/src/graphql/typeDefs.ts.ejs', `${BACK}/src/graphql/typeDefs.ts`, { entities, schema });
  render('backend/src/graphql/resolvers.ts.ejs', `${BACK}/src/graphql/resolvers.ts`, { entities, schema, authEntity });
}

// ---------------------------------------------------------------------
// FRONTEND
// ---------------------------------------------------------------------
render('frontend/package.json.ejs', `${FRONT}/package.json`, { schema });
render('frontend/angular.json.ejs', `${FRONT}/angular.json`, { schema });
render('frontend/tsconfig.json.ejs', `${FRONT}/tsconfig.json`, {});
render('frontend/src/index.html.ejs', `${FRONT}/src/index.html`, { schema });
render('frontend/src/main.ts.ejs', `${FRONT}/src/main.ts`, { schema });
render('frontend/src/polyfills.ts.ejs', `${FRONT}/src/polyfills.ts`, {});
render('frontend/src/styles.scss.ejs', `${FRONT}/src/styles.scss`, { schema });

render('frontend/src/app/app.module.ts.ejs', `${FRONT}/src/app/app.module.ts`, { schema });
render('frontend/src/app/app-routing.module.ts.ejs', `${FRONT}/src/app/app-routing.module.ts`, { schema });
render('frontend/src/app/app.component.html.ejs', `${FRONT}/src/app/app.component.html`, { schema });
render('frontend/src/app/app.component.ts.ejs', `${FRONT}/src/app/app.component.ts`, { schema });

// Auth core
render('frontend/src/app/core/auth/auth.service.ts.ejs', `${FRONT}/src/app/core/auth/auth.service.ts`, { schema });
render('frontend/src/app/core/auth/jwt.interceptor.ts.ejs', `${FRONT}/src/app/core/auth/jwt.interceptor.ts`, { schema });
render('frontend/src/app/core/auth/auth.guard.ts.ejs', `${FRONT}/src/app/core/auth/auth.guard.ts`, { schema });

// Feature modules
for (const ent of entities) {
  const name = ent.name;
  const kebab = toKebab(name);
  const featurePath = `${FRONT}/src/app/features/${kebab}`;
  fs.ensureDirSync(featurePath);

  render('frontend/src/app/features/entity/entity.module.ts.ejs', `${featurePath}/${kebab}.module.ts`, { ent, name, kebab, schema });
  render('frontend/src/app/features/entity/entity.service.ts.ejs', `${featurePath}/${kebab}.service.ts`, { ent, name, kebab, schema });
  render('frontend/src/app/features/entity/entity-list.component.html.ejs', `${featurePath}/${kebab}-list.component.html`, { ent, name, kebab, schema });
  render('frontend/src/app/features/entity/entity-list.component.ts.ejs', `${featurePath}/${kebab}-list.component.ts`, { ent, name, kebab, schema });
  render('frontend/src/app/features/entity/entity-form.component.html.ejs', `${featurePath}/${kebab}-form.component.html`, { ent, name, kebab, schema });
  render('frontend/src/app/features/entity/entity-form.component.ts.ejs', `${featurePath}/${kebab}-form.component.ts`, { ent, name, kebab, schema });
}

// Ngx-Admin pages
if (adminPanel) {
  render('frontend/src/app/@theme/@theme.module.ts.ejs', `${FRONT}/src/app/@theme/@theme.module.ts`, { schema });
  render('frontend/src/app/@theme/styles/themes.scss.ejs', `${FRONT}/src/app/@theme/styles/themes.scss`, { schema });
  render('frontend/src/app/pages/pages.module.ts.ejs', `${FRONT}/src/app/pages/pages.module.ts`, { schema });
  render('frontend/src/app/pages/dashboard/dashboard.component.html.ejs', `${FRONT}/src/app/pages/dashboard/dashboard.component.html`, { schema });
  render('frontend/src/app/pages/dashboard/dashboard.component.ts.ejs', `${FRONT}/src/app/pages/dashboard/dashboard.component.ts`, { schema });
}

// ---------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------
console.log(`\nProject generated at: ${outDir}`);
console.log(`\nNext steps:`);
console.log(`  cd ${outDir}`);
if (docker) console.log(`  docker-compose up --build`);
if (terraform) console.log(`  cd terraform && terraform init && terraform apply`);
console.log(`\n`);