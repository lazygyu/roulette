# Mono Repository Structure information

- This project uses a monorepo structure.
- It has root(/package.json), backend(/backend/package.json), frontend(/frontend/package.json) and common(/common/package.json).
  - You should consider where to edit.
  - You should think about running environments.
- Root, backend, frontend and common all use yarn.
  - using npm will break total projects.
  - You should use yarn only.
- You can edit backend, frontend and common packages.
  - You can build all packages by running `yarn build` at root directory.
  - You can run backend and frontend at the same time, by using `yarn dev` command at root directory.