import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asynHandler} from "../utils/asyncHandler.js"

const getChannelStats = asynHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const userId = req.user._id
    
    const totalSubscribers = await Subscription.aggregate([
        {
            $match: { channel: new mongoose.Types.ObjectId(userId) }
        },
        {
            $count: "subscribersCount"
        }
    ])

    const videoStats = await Video.aggregate([
        {
            $match: { owner: new mongoose.Types.ObjectId(userId) }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $group: {
                _id: null,
                totalLikes: {
                    $sum: { $size: "$likes" }
                },
                totalViews: {
                    $sum: "$views"
                },
                totalVideos: {
                    $sum: 1
                }
            }
        }
    ])

    const channelStats = {
        totalSubscribers: totalSubscribers[0]?.subscribersCount || 0,
        totalVideos: videoStats[0]?.totalVideos || 0,
        totalLikes: videoStats[0]?.totalLikes || 0,
        totalViews: videoStats[0]?.totalViews || 0,
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channelStats, "channel stats fetched successfully!")
    )
})

const getChannelVideos = asynHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const userId = req.user._id

    const channelVideos = await Video.aggregate([
        {
            $match: { owner: new mongoose.Types.ObjectId(userId) }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $project: {
                _id: 1,
                title: 1,
                views: 1,
                "thumbnail.url": 1,
                createdAt: 1,
                isPublished: 1
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, channelVideos, "channel videos fetched successfully!")
    )
})

export {
    getChannelStats, 
    getChannelVideos
    }