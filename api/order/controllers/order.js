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
      first_name,
      last_name,
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
      payment_method,
      promos,
    } = ctx.request.body;

    let products = JSON.parse(items);

    const variantIds = products.map((p) => Number(p.variantId));
    const variants = await Promise.all(
      variantIds.map((id) => strapi.services.variant.findOne({ id }))
    );

    let promo;
    if (promos?.length) {
      promo = await strapi.services.promo.findOne({ id: promos[0] });
    }

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
      (sum, product) =>
        math
          .chain(sum)
          .add(math.chain(product.price).multiply(product.qty).done())
          .done(),
      0
    );

    const discount = promo
      ? math.chain(sub_total).multiply(`0.${promo.percent_discount}`).done()
      : 0;

    const isFreeShipping =
      promo &&
      promo.free_shipping &&
      sub_total >= promo.free_shipping_threshold;

    const total = math
      .chain(sub_total)
      .subtract(discount)
      .add(isFreeShipping ? 0 : shipping)
      .done();

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

    const payment =
      payment_method === "bpi"
        ? "BPI Account Number: 1519079875"
        : "GCASH: 09162889221";

    const shipping_method =
      shipping == "0"
        ? "Free"
        : shipping === "79"
        ? "Metro Manila"
        : "Outside Metro Manila";

    const htmlTemplate = `<!DOCTYPE html><html lang="en" style="box-sizing:border-box"><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Love Edith</title></head><body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border-collapse:collapse"><table cellspacing="0" cellpadding="0" border="0" bgcolor="#fff" style="width:100%"><thead><tr><th><h2 style="margin-bottom:24px">Hi, love! &#9825; We've received your order.</h2></th></tr></thead><tbody><tr><td colspan="4"><h4 style="margin:0;text-decoration-line:underline">Issued To:</h4><p style="margin:0">${first_name} ${last_name}</p><p style="margin:0">${email}</p><p style="margin:0">+63 ${contact_number}</p></td></tr><tr style="height:24px"></tr><tr><td><h4 style="margin:0;text-decoration-line:underline">Shipment Details:</h4><p style="margin:0">${house_building_unit} ${street}</p><p style="margin:0">Barangay ${barangay}, ${city}</p><p style="margin:0">${province} ${region}</p><p style="margin:0">${landmarks}</p></td></tr><tr style="height:24px"></tr><tr><td><h4 style="margin:0;text-decoration-line:underline">Shipping Method:</h4><p style="margin:0">${shipping_method}</p></td></tr><tr style="height:24px"></tr><tr style="height:24px"></tr><tr><td><table style="max-width:400px;text-align:left;border-collapse:collapse;width:100%"><thead><tr><th><h4 style="margin:0;text-decoration-line:underline">Items</h4></th></tr></thead><tbody>${products
      .map((item) => {
        const total = math.chain(item.qty).multiply(item.price).done();
        return `<tr><td>${
          item.name
        }</td><td><span style="text-transform:capitalize">${
          item.color
        }</span> | <span style="text-transform:capitalize">${
          item.size
        }</span></td><td></td></tr><tr><td>${item.qty}x</td><td>${PHP(
          item.price
        ).format()}</td><td>${PHP(
          total
        ).format()}</td></tr><tr style="height: 8px"></tr>`;
      })
      .join("")}<tr style="height:24px"></tr><tr><td><td>Subtotal</td><td>${PHP(
      sub_total
    ).format()}</td></tr><tr><td><td>Shipping</td><td>${
      isFreeShipping || shipping === "0" ? "FREE" : PHP(shipping).format()
    }</td></tr>${
      discount
        ? `<tr><td><td>Discount - ${promo.percent_discount}% off</td><td>-${PHP(
            discount
          ).format()}</td></tr>`
        : ""
    }<tr><td><td>Total</td><td>${PHP(total).format()}</td></tr>${
      hasItemsRemoved
        ? `<tr style="margin-top: 8px"><td colspan="3" style="font-size: 10px">* Some items have been removed due to availability</td></tr>`
        : ""
    }</tbody></table></td></tr><tr style="height:24px"></tr><tr><td><h4 style="margin:0;text-decoration-line:underline">Payment Method:</h4><p style="margin:0;">${payment}</p></td></tr><tr style="height:24px"></tr><tr><td><h4 style="margin:0;text-decoration-line:underline">Payment Due Date:</h4><p style="margin:0">${dateFns.format(
      dueDate,
      "MMMM do, yyyy"
    )}</p></td></tr></tbody></table></body></html>
    `;

    const orderTemplate = {
      subject: `Order #${order_number}`,
      text: "",
      html: htmlTemplate,
    };

    if (entity.id) {
      await strapi.plugins["email"].services.email.sendTemplatedEmail(
        {
          to:
            process.env.NODE_ENV === "production"
              ? email
              : "lebilly87@gmail.com",
        },
        orderTemplate
      );
      if (process.env.NODE_ENV === "production") {
        await strapi.plugins["email"].services.email.sendTemplatedEmail(
          {
            to: "shop@love-edith.com",
          },
          {
            subject: `An order has been placed: #${order_number}`,
            text: "",
            html: htmlTemplate,
          }
        );
      }
    }

    return sanitizeEntity(entity, { model: strapi.models.order });
  },
};
