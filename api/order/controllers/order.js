"use strict";
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { v4 } = require("uuid");
const randomatic = require("randomatic");
const { sanitizeEntity } = require("strapi-utils");

module.exports = {
  async create(ctx) {
    const { email, items } = ctx.request.body;

    let products = JSON.parse(items);
    const variantIds = products.map((p) => Number(p.variantId));
    const variants = await Promise.all(
      variantIds.map((id) => strapi.services.variant.findOne({ id }))
    );

    let removedProducts = [];

    if (variants) {
      for (const variant of variants) {
        if (variant.qty === 0) {
          removedProducts.push(variant);
          products = products.filter((p) => Number(p.variantId) !== variant.id);
        }
      }
    }

    const sub_total = products.reduce(
      (sum, product) => sum + product.price * product.qty,
      0
    );

    let order_number = randomatic("0", 9);
    let hasOrderNumberDefined = await strapi.services.order.findOne({
      order_number,
    });

    while (hasOrderNumberDefined) {
      order_number = randomatic("0", 9);
      hasOrderNumberDefined = await strapi.services.order.findOne({
        order_number,
      });
    }

    let entity = await strapi.services.order.create({
      ...ctx.request.body,
      uuid: v4(),
      order_number,
      sub_total,
      total: sub_total,
    });

    const orderTemplate = {
      subject: `Order #${order_number}`,
      text: "",
      html: `
      <div style="background: blue">
        This is awesome
      </div>
    `,
    };

    if (entity.id) {
      // await strapi.plugins["email"].services.email.sendTemplatedEmail(
      //   {
      //     to: email,
      //   },
      //   orderTemplate
      // );
    }

    return sanitizeEntity(entity, { model: strapi.models.order });
  },
};
