import 'dotenv/config';
import connectDB from './db/index.js';

connectDB();
































/*
import express from "express";
const app = express();
(async () => {
  try {
    const connectioninstence = await mongoose.connect(`${process.env.DATABASE_URL}/${DB_NAME}`);
    console.log(`Connected to MongoDB!! DB Host: ${connectioninstence.connection.host}`);

    app.on("error", (err) => {
      console.error("Express server error:", err);
      throw err;
    });

    app.listen(process.env.PORT, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
})();
*/
