module.exports = {
  apps: [
    {
      name: 'voicebot-bz-telecom',
      script: 'src/index.js',
      cwd: '/opt/bz-voicebot-ari',
      interpreter: 'node',
      env_file: 'deploy/env/bz-telecom.env',
      env: {
        NODE_ENV: 'production',
        RUNTIME_TENANT: 'bz-telecom',
        ARI_APP: 'voicebot-bz-telecom',
      },
    },
    {
      name: 'voicebot-clinique-alpha',
      script: 'src/index.js',
      cwd: '/opt/bz-voicebot-ari',
      interpreter: 'node',
      env_file: 'deploy/env/clinique-alpha.env',
      env: {
        NODE_ENV: 'production',
        RUNTIME_TENANT: 'clinique-alpha',
        ARI_APP: 'voicebot-clinique-alpha',
      },
    },
  ],
};
