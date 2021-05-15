// @ts-check
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
      shipping_method,
      payment_method,
      discount: _discount,
    } = ctx.request.body;

    let products = JSON.parse(items);

    const variantIds = products.map((p) => Number(p.variantId));
    const variants = await Promise.all(
      variantIds.map((id) => strapi.services.variant.findOne({ id }))
    );

    let promo;
    if (_discount) {
      promo = await strapi.services.discount.findOne({ id: _discount });
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

    const hasFreeShipping = !!products.find(
      (product) => product.hasFreeShipping
    );

    const sub_total = products.reduce(
      (sum, product) =>
        math
          .chain(sum)
          .add(math.chain(product.price).multiply(product.qty).done())
          .done(),
      0
    );

    let percentDiscount = 0;
    let amountDiscount = 0;
    if (promo) {
      if (sub_total >= promo.amount_threshold) {
        amountDiscount = math.chain(amountDiscount).add(promo.amount).done();
      }
      if (sub_total >= promo.percent_discount_threshold) {
        percentDiscount = math
          .chain(sub_total)
          .subtract(amountDiscount)
          .multiply(math.chain(promo.percent_discount).divide(100).done())
          .done();
      }
    }

    let total = math
      .chain(sub_total)
      .subtract(amountDiscount)
      .subtract(percentDiscount)
      .done();

    const isFreeShipping =
      hasFreeShipping ||
      (promo && promo.free_shipping && total >= promo.free_shipping_threshold);

    total = math
      .chain(total)
      .add(isFreeShipping ? 0 : shipping)
      .done();

    let order_number = randomatic("0", 5);
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

    const payment = payment_method === "bpi" ? "BPI" : "GCASH";

    const htmlTemplate = `<!DOCTYPE html><html lang="en" style="box-sizing:border-box"><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width,initial-scale=1"><title>love, edith</title></head><body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border-collapse:collapse; font-size: 14px;"><table cellspacing="0" cellpadding="0" border="0" bgcolor="#fff" style="width:100%"><thead><tr><th><h2 style="font-size: 20px">Hi, love! &#9825;</h2><h2>Thank you for choosing Love, Edith!</h2><p style="margin-bottom: 24px">Your support means a lot to us. Here’s what’s coming your way:</p></th></tr></thead><tbody><tr><td colspan="4"><h4 style="margin:0;text-decoration-line:underline">Issued To:</h4><p style="margin:0">${first_name} ${last_name}</p><p style="margin:0">${email}</p><p style="margin:0">+63 ${contact_number}</p></td></tr><tr style="height:24px"></tr><tr><td><h4 style="margin:0;text-decoration-line:underline">Shipment Address:</h4><p style="margin:0">${house_building_unit} ${street}</p><p style="margin:0">Barangay ${barangay}, ${city}</p><p style="margin:0">${province} ${region}</p><p style="margin:0">${landmarks}</p></td></tr><tr style="height:24px"></tr><tr><td><h4 style="margin:0;text-decoration-line:underline">Shipping Method:</h4><p style="margin:0">${shipping_method}</p></td></tr><tr style="height:24px"></tr><tr style="height:24px"></tr><tr><td><table style="max-width:400px;text-align:left;border-collapse:collapse;width:100%"><thead><tr><th>Item</h4></th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${products
      .map((item) => {
        const total = math.chain(item.qty).multiply(item.price).done();
        return `<tr><td>
        <div>${item.name}</div>
        <div><span style="text-transform: uppercase;">${
          item.color
        }</span> | <span style="text-transform: uppercase;">${
          item.size
        }</span></div>
        </td>
        <td>${item.qty}</td>
        <td>${PHP(item.price).format()}</td>
        <td>${PHP(total).format()}</td>
        </tr><tr style="height: 8px"></tr>`;
      })
      .join(
        ""
      )}<tr style="height:24px; border-top: 1px solid black;"></tr><tr><td colspan="3">Subtotal</td><td>${PHP(
      sub_total
    ).format()}</td></tr><tr><td colspan="3">Shipping</td><td>${
      isFreeShipping || shipping === "0" ? "FREE" : PHP(shipping).format()
    }</td></tr>${
      amountDiscount
        ? `<tr><td colspan="3">Discount</td><td>-${PHP(
            amountDiscount
          ).format()}</td></tr>`
        : ""
    }${
      percentDiscount
        ? `<tr><td colspan="3">Discount - ${
            promo.percent_discount
          }% off</td><td>-${PHP(percentDiscount).format()}</td></tr>`
        : ""
    }<tr style="border-top: 1px solid black;"><td colspan="3" style="font-weight: 500;">Total</td><td style="font-weight: 500;">${PHP(
      total
    ).format()}</td></tr>${
      hasItemsRemoved
        ? `<tr><td colspan="4" style="font-size: 10px; padding-top: 8px;">* Some items have been removed due to availability</td></tr>`
        : ""
    }</tbody></table></td></tr><tr style="height:24px"></tr><tr><td><h4 style="margin:0;text-decoration-line:underline">Payment Method: <span style="font-size: 16px;font-weight: 400;">${payment}</span></h4></td></tr><tr style="height:24px"></tr>
    <tr><td><p style="margin:0;">Please expect our payment details in a separate e-mail within 24 to 48 hours.</p></td></tr><tr style="height:24px"></tr><tr><td><p style="margin:0">We can’t wait for you to receive your pieces and see you lounge in them!</p></td></tr><tr style="height:24px"></tr><tr><td><p style="margin:0">Love, Edith</p></td></tr></tbody></table></body></html>
    `;

    const orderTemplate = {
      subject: `We’ve got your order! #${order_number}`,
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
