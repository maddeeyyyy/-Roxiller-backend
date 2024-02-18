const express = require("express");
const mongoose = require("mongoose");

const Transaction = require("./models/3party");

const app = express();
app.use(express.json());

const PORT = 5000;

mongoose
  .connect(
    "mongodb+srv://intern:Madhur123@cluster0.qmftfu0.mongodb.net/intern?retryWrites=true&w=majority"
  )
  .then(() => {
    console.log("COnnected to db");
  })
  .catch((err) => {
    console.log(err);
  });

app.post("api/database", async (req, res) => {
  try {
    const response = await fetch(
      "https://s3.amazonaws.com/roxiler.com/product_transaction.json"
    );
    const data = await response.json();

    await Transaction.deleteMany();
    await Transaction.insertMany(data);

    res.status(200).json({ message: "Database initialized successfully" });
  } catch (error) {
    console.error("Error initializing darabase", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("api/transactions", async (req, res) => {
  try {
    const { page = 1, perPage = 10, search = "" } = req.query;
    const searchQuery = search.trim();

    // Apply search and pagination
    const transactions = await Transaction.find({
      $or: [
        { title: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } },
        { price: { $regex: searchQuery, $options: "i" } },
      ],
    })
      .skip((page - 1) * perPage)
      .limit(parseInt(perPage));

    res.status(200).json({ transactions });
  } catch (error) {
    console.error("Failed to list transactions:", error);
    res.status(500).json({ error: "Failed to list transactions" });
  }
});

app.get("api/statistics", async (req, res) => {
  try {
    const data = await Transaction.find();

    const { month } = req.query;

    // Validate the month valu
    const parsedMonth = parseInt(month, 10);
    if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      throw new Error("Invalid month value");
    }
    // Calculate total sale amount
    const totalSaleAmount = await Transaction.aggregate([
      {
        $match: {
          $expr: {
            $eq: [{ $month: "$dateOfSale" }, parsedMonth],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$price" },
        },
      },
    ]);

    const totalSoldItems = await Transaction.countDocuments({
      $expr: {
        $eq: [{ $month: "$dateOfSale" }, parsedMonth],
      },
    });

    //     // Calculate total not sold items
    const totalNotSoldItems = await Transaction.countDocuments({
      $expr: {
        $eq: [{ $month: "$dateOfSale" }, parsedMonth],
      },
      sold: false,
    });

    res.status(200).json({
      totalSaleAmount:
        totalSaleAmount.length > 0 ? totalSaleAmount[0].totalAmount : 0,
      totalSoldItems,
      totalNotSoldItems,
    });
  } catch (error) {
    console.error("Failed to fetch statistics:", error);
    if (error.message === "Invalid month value") {
      res.status(400).json({ error: "Invalid month value" });
    } else {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  }
});

app.get("api/bar-chart", async (req, res) => {
  try {
    const { month } = req.query;

    // Define price ranges
    const priceRanges = [
      { range: "0-100", count: 0 },
      { range: "101-200", count: 0 },
      { range: "201-300", count: 0 },
    ];

    // Fetch transactions of the selected month
    const transactions = await Transaction.find({
      $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] },
    });

    // Count the number of items in each price range
    transactions.forEach((transaction) => {
      const price = transaction.price;
      if (price >= 0 && price <= 100) {
        priceRanges[0].count++;
      } else if (price >= 101 && price <= 200) {
        priceRanges[1].count++;
      } else if (price >= 201 && price <= 300) {
        priceRanges[2].count++;
      }
    });

    res.status(200).json({ priceRanges });
  } catch (error) {
    console.error("Failed to generate bar chart:", error);
    res.status(500).json({ error: "Failed to generate bar chart" });
  }
});

app.get("api/pie-chart", async function generatePieChart(req, res) {
  try {
    const { month } = req.query;

    // Fetch transactions of the selected month
    const transactions = await Transaction.find({
      $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(month)] },
    });

    // Calculate unique categories and their item counts
    const categoryCounts = {};
    transactions.forEach((transaction) => {
      const category = transaction.category;
      if (categoryCounts.hasOwnProperty(category)) {
        categoryCounts[category]++;
      } else {
        categoryCounts[category] = 1;
      }
    });

    res.status(200).json({ categoryCounts });
  } catch (error) {
    console.error("Failed to generate pie chart:", error);
    res.status(500).json({ error: "Failed to generate pie chart" });
  }
});

app.listen(PORT, () => {
  console.log(`App is listening to port: ${PORT}`);
});
