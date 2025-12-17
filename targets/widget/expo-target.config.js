/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "widget",
  icon: 'https://github.com/expo.png',
  entitlements: {
    // 👇 Esta linha é OBRIGATÓRIA para o widget ler os dados
    "com.apple.security.application-groups": ["group.br.com.gymbeat"],
  },
});