import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {timestamps: true})

// One unique relationship per subscriber/channel pair
subscriptionSchema.index(
    { subscriber: 1, channel: 1 },
    { unique: true }
)

// Quickly find everyone subscribed to a channel
subscriptionSchema.index({ channel: 1 })

export const Subscription = mongoose.model("Subscription", subscriptionSchema)