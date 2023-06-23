const mongoose = require("mongoose");
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("Connected to DB.")
})

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        minLength: 5
    },
    phone: {
        type: String,
        minLength: 5
    },
    street: {
        type: String,
        required: true,
        minLength: 5
    },
    city: {
        type: String,
        required: true,
        minLength: 3
    }
})


module.exports = mongoose.model("Person", schema);