// Runs as the "preinstall" script: stops npm, yarn and bun from installing
// this project so pnpm-lock.yaml stays the only lockfile.
const agent = process.env.npm_config_user_agent || ''

if (!agent.startsWith('pnpm/')) {
	const used = agent.split(' ')[0] || 'an unknown package manager'
	console.error(`
  This project uses pnpm only (you ran ${used}).

    pnpm install

  Need pnpm? See https://pnpm.io/installation
`)
	process.exit(1)
}
