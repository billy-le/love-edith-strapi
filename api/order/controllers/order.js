"use strict";
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { v4 } = require("uuid");
const randomatic = require("randomatic");
const { sanitizeEntity } = require("strapi-utils");
const math = require("mathjs");
const dateFns = require("date-fns");
const currency = require("currency.js");

function PHP(value) {
  return currency(value, {
    symbol: "₱",
    decimal: ".",
    separator: ",",
    precision: 2,
  });
}

const sizeMap = {
  xs: "EXTRA SMALL",
  s: "SMALL",
  m: "MEDIUM",
  l: "LARGE",
  xl: "EXTRA LARGE",
};

module.exports = {
  async create(ctx) {
    const {
      name,
      contact_number,
      house_building_unit,
      street,
      city,
      barangay,
      province,
      region,
      landmarks,
      email,
      items,
      shipping,
    } = ctx.request.body;

    let products = JSON.parse(items);

    const variantIds = products.map((p) => Number(p.variantId));
    const variants = await Promise.all(
      variantIds.map((id) => strapi.services.variant.findOne({ id }))
    );

    let removedProducts = [];
    let hasItemsRemoved = false;

    if (variants) {
      for (const variant of variants) {
        if (variant.qty === 0) {
          removedProducts.push(variant);
          products = products.filter((p) => Number(p.variantId) !== variant.id);
          hasItemsRemoved = true;
        } else {
          const customerItem = products.find((p) => p.variantId == variant.id);
          const qtyRemaining = variant.qty;

          if (customerItem.qty > qtyRemaining) {
            customerItem.qty = qtyRemaining;
            hasItemsRemoved = true;
          }
        }
      }
    }

    const sub_total = products.reduce(
      (sum, product) => sum + product.price * product.qty,
      0
    );

    const total = math.chain(sub_total).add(shipping).done();

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
      items: products,
      uuid: v4(),
      order_number,
      sub_total,
      total,
      shipping,
    });

    const { created_at } = entity;

    const dueDate = dateFns.addHours(new Date(created_at), 48);

    // const orderTemplate = {
    //   subject: `Order #${order_number}`,
    //   text: "",
    //   html: ``,
    // };

    // if (entity.id) {
    //   await strapi.plugins["email"].services.email.sendTemplatedEmail(
    //     {
    //       to:
    //         process.env.NODE_ENV === "production"
    //           ? email
    //           : "lebilly87@gmail.com",
    //     },
    //     orderTemplate
    //   );
    // }

    return sanitizeEntity(entity, { model: strapi.models.order });
  },
};
