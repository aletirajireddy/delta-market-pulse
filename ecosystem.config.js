module.exports = {
  apps: [
    {
      name: 'delta-market-pulse',
      script: 'server/index.js',
      watch: false, // avoid restart-on-save port-flap, same reasoning as the old project
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
