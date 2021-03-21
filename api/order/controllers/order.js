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
      uuid: v4(),
      order_number,
      sub_total,
      total,
      shipping,
    });

    const { created_at } = entity;

    const dueDate = dateFns.addHours(new Date(created_at), 48);

    const orderTemplate = {
      subject: `Order #${order_number}`,
      text: "",
      html: `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">

        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Your Invoice</title>
          <style type="text/css">
          html {
            line-height: 1.15;
            -webkit-text-size-adjust: 100%;
          }

          body {
            margin: 0;
          }

          main {
            display: block;
          }

          h1 {
            font-size: 2em;
            margin: 0.67em 0;
          }

          hr {
            box-sizing: content-box;
            height: 0;
            overflow: visible;
          }

          pre {
            font-family: monospace, monospace;
            font-size: 1em;
          }

          a {
            background-color: transparent;
          }

          abbr[title] {
            border-bottom: none;
            text-decoration: underline;
            text-decoration: underline dotted;
          }

          b,
          strong {
            font-weight: bolder;
          }

          code,
          kbd,
          samp {
            font-family: monospace, monospace;
            font-size: 1em;
          }

          small {
            font-size: 80%;
          }

          sub,
          sup {
            font-size: 75%;
            line-height: 0;
            position: relative;
            vertical-align: baseline;
          }

          sub {
            bottom: -0.25em;
          }

          sup {
            top: -0.5em;
          }

          img {
            border-style: none;
          }

          button,
          input,
          optgroup,
          select,
          textarea {
            font-family: inherit;
            font-size: 100%;
            line-height: 1.15;
            margin: 0;
          }

          button,
          input {
            overflow: visible;
          }

          button,
          select {
            text-transform: none;
          }

          button,
          [type="button"],
          [type="reset"],
          [type="submit"] {
            -webkit-appearance: button;
          }

          button::-moz-focus-inner,
          [type="button"]::-moz-focus-inner,
          [type="reset"]::-moz-focus-inner,
          [type="submit"]::-moz-focus-inner {
            border-style: none;
            padding: 0;
          }

          button:-moz-focusring,
          [type="button"]:-moz-focusring,
          [type="reset"]:-moz-focusring,
          [type="submit"]:-moz-focusring {
            outline: 1px dotted ButtonText;
          }

          fieldset {
            padding: 0.35em 0.75em 0.625em;
          }

          legend {
            box-sizing: border-box;
            color: inherit;
            display: table;
            max-width: 100%;
            padding: 0;
            white-space: normal;
          }

          progress {
            vertical-align: baseline;
          }

          textarea {
            overflow: auto;
          }

          [type="checkbox"],
          [type="radio"] {
            box-sizing: border-box;
            padding: 0;
          }

          [type="number"]::-webkit-inner-spin-button,
          [type="number"]::-webkit-outer-spin-button {
            height: auto;
          }

          [type="search"] {
            outline-offset: -2px;
          }

          [type="search"]::-webkit-search-decoration {
            -webkit-appearance: none;
          }

          ::-webkit-file-upload-button {
            -webkit-appearance: button;
            font: inherit;
          }

          details {
            display: block;
          }

          summary {
            display: list-item;
          }

          template {
            display: none;
          }

          [hidden] {
            display: none;
          }
          </style>

        </head>
        <body>
        <div style="display: flex; justify-content: center">
        <img
          src="https://loveedith.netlify.app/assets/love-edith-logo.jpg"
          height="100px"
        />
      </div>

      <div
        style="
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          grid-gap: 2rem;
          margin-top: 3rem;
        "
      >
        <div style="border-top: 5px solid black; padding-top: 1rem">
          <p style="text-transform: uppercase; font-weight: 900">Invoice #:</p>
          <p>${order_number}</p>
        </div>

        <div style="border-top: 5px solid black; padding-top: 1rem">
          <p style="text-transform: uppercase; font-weight: 900">Date Issued:</p>
          <p>${dateFns.format(created_at, "EEEE")}</p>
          <p>${dateFns.format(created_at, "MMMM d, yyyy")}</p>
        </div>

        <div style="border-top: 5px solid black; padding-top: 1rem">
          <p style="text-transform: uppercase; font-weight: 900">Issued To:</p>
          <p>${name}</p>
          <p>${contact_number}</p>
          <p>${house_building_unit} ${street}</p>
          <p>${barangay}, ${city}</p>
          <p>${region}, ${province}, PH</p>
          <p>Landmarks:</p>
          <p>${landmarks}</p>
        </div>
      </div>

      <table
        style="
          width: 100%;
          margin-top: 5rem;
          border-collapse: collapse;
          text-align: center;
        "
      >
        <thead>
          <tr>
            <th
              style="
                padding: 1rem 0;
                border-top: 5px solid lightgray;
                border-bottom: 5px solid lightgray;
              "
            >
              Description
            </th>
            <th
              style="
                padding: 1rem 0;
                border-top: 5px solid lightgray;
                border-bottom: 5px solid lightgray;
              "
            >
              Qty
            </th>
            <th
              style="
                padding: 1rem 0;
                border-top: 5px solid lightgray;
                border-bottom: 5px solid lightgray;
              "
            >
              Price
            </th>
            <th
              style="
                padding: 1rem 0;
                border-top: 5px solid lightgray;
                border-bottom: 5px solid lightgray;
              "
            >
              Total
            </th>
          </tr>
        </thead>

        <tbody>
           ${products.map(({ name, price, qty, size, color }) => {
             const total = math.chain(qty).multiply(price).done();
             const sizeName = sizeMap[size];
             return `<tr>
               <td style="padding: 1rem 0">
               <p>${name} (${sizeName})</p>
               <p>${color}</p>
               </td>
               <td style="padding: 1rem 0">${qty}</td>
               <td style="padding: 1rem 0">${PHP(price).format()}</td>
               <td style="padding: 1rem 0">${PHP(total).format()}</td>
           </tr>`;
           })}

          <tr>
            <td style="padding-top: 1rem; border-top: 5px solid lightgray"></td>
            <td style="padding-top: 1rem; border-top: 5px solid lightgray"></td>
            <td style="padding-top: 1rem; border-top: 5px solid lightgray">
              Sub Total
            </td>
            <td style="padding-top: 1rem; border-top: 5px solid lightgray">${PHP(
              sub_total
            ).format()}</td>
          </tr>

          <tr>
            <td></td>
            <td></td>
            <td>Shipping</td>
            <td>${PHP(shipping).format()}</td>
          </tr>

          <tr>
            <td></td>
            <td></td>
            <td>Total</td>
            <td>${PHP(total).format()}</td>
          </tr>
        </tbody>
      </table>

      <div
        style="
          margin-top: 5rem;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          grid-gap: 1rem;
        "
      >
        <div style="border-top: 5px solid black; padding-top: 1rem">
          <p style="text-transform: uppercase; font-weight: 900">Payment Details:</p>
          <p>G-CASH</p>
          <p>+63-916-288-9221</p>
          <div style="margin-top: 1rem" />
          <p>BPI</p>
          <p>1519-0798-75</p>
        </div>

        <div style="border-top: 5px solid black; padding-top: 1rem">
          <p style="text-transform: uppercase; font-weight: 900">Due By:</p>
          <p>${dateFns.format(dueDate, "EEEE")}</p>
          <p>${dateFns.format(dueDate, "MMMM d, yyyy")}</p>
        </div>

        <div style="border-top: 5px solid black; padding-top: 1rem">
          <p style="text-transform: uppercase; font-weight: 900">
            Thank You
            <span
              ><img
                src="https://loveedith.netlify.app/assets/hearts.png"
                height="32px"
                width="32px"
            /></span>
          </p>
          <p>FB/IG</p>
          <p>@LOVEEDITH.PH</p>
        </div>
      </div>

        </body>
        </html>
      `,
    };

    if (entity.id) {
      await strapi.plugins["email"].services.email.sendTemplatedEmail(
        {
          to: email,
        },
        orderTemplate
      );
    }

    return sanitizeEntity(entity, { model: strapi.models.order });
  },
};
