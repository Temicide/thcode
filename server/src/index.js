import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.get("/health", (req, res) => {
  res.send("OK");
});

app.listen(process.env.PORT, () => {
  console.log(`Your application is running on port : ${process.env.PORT}`);
});
