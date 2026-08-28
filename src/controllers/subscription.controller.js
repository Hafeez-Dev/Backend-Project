import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asynHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asynHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription
    if(!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channelId!")
    }

    const existedSubscriber = await Subscription.findOne({
        channel: channelId,
        subscriber: req.user._id
    })

    let subscribed
    let message

    if(!existedSubscriber) {
        await Subscription.create({
            subscriber: req.user._id,
            channel: channelId
        })

        subscribed = true
        message = "Subscribed to channel successfully!"

    } else {
        await existedSubscriber.deleteOne()

        subscribed = false
        message = "Unsubscribed from channel successfully!"
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, {subscribed}, message )
    )

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asynHandler(async (req, res) => {
    const {channelId} = req.params

    if(!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channelId!")
    }

    const subscribers = await Subscription.aggregate([
        {
            $match: { channel: new mongoose.Types.ObjectId(channelId) }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber"
            }
        },
        {
            $unwind: "$subscriber"
        },
        {
            $project: {
                _id: "$subscriber._id",
                username: "$subscriber.username",
                fullName: "$subscriber.fullName",
                avatar: "$subscriber.avatar.url"
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, subscribers, "subscribers fetched successfully!")
    )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asynHandler(async (req, res) => {
    const { subscriberId } = req.params

    if(!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriberId!")
    }

    const subscribedToChannels = await Subscription.aggregate([
        {
            $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel"
            }
        },
        {
            $unwind: "$channel"
        },
        {
            $project: {
                _id: "$channel._id",
                username: "$channel.username",
                fullName: "$channel.fullName",
                avatar: "$channel.avatar.url"
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, subscribedToChannels, "subscribedTo channels are fetched successfully!")
    )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}