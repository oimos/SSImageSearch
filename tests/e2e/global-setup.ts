import { execSync } from 'child_process'

export default function globalSetup(): void {
  console.log('[E2E] Building Electron app...')
  execSync('npx electron-vite build', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env }
  })
  console.log('[E2E] Build complete.')
}
