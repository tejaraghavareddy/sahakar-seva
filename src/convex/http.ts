import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { razorpayWebhook } from "./paymentsWebhook";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({
  path: "/razorpay_webhook",
  method: "POST",
  handler: razorpayWebhook,
});

export default http;
