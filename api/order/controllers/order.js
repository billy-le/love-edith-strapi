"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async create(ctx) {
    await strapi.plugins["email"].services.email.send({
      to: "lebilly87@gmail.com",
      from: "admin@love-edith.io",
      subject: "ORDER CONFIRMED",
      text: `
          The comment #aaldkfjlaskdf contain a bad words.

          Comment:
            YOU SUCK
        `,
    });
    return "hi";
  },
};
