# Mono Repository Structure informations

- This project is mono repository structure.
- It has root(/package.json), backend(/backend/package.json) and frontend(/frontend/package.json).
  - You should consider where to edit.
  - You should think about running environments.
- Root, backend and frontend all use yarn.
  - using npm will break total projects.
  - You should use yarn only.
- You can modify both backend and frontend.
  - You can run backend and frontend at the same time, by using `yarn dev` command at root directory.