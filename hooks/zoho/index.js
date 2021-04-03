module.exports = (strapi) => {
  return {
    async initialize() {
      const config = strapi.config.get("hook.settings.zoho");
      console.log(config);
      // strapi.services.github = new GitHubAPI({
      //   userAgent: `${strapi.config.get('info.name')} v${strapi.config.get('info.version')}`,
      //   auth: `token ${token}`,
      // });
    },
  };
};
