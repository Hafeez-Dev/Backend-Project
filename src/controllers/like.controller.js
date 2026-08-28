import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asynHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asynHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId!")
    }

    const likedAlready = await Like.findOne({
        video: videoId,
        likeBy: req.user._id
    })

    let liked
    let message

    if(!likedAlready) {
        await Like.create({
            video: videoId,
            likeBy: req.user._id
        })

        liked = true
        message = "Video liked successfully!"
    } else {
        await likedAlready.deleteOne()

        liked = false
        message = "Video unliked successfully!"
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, {liked}, message)
    )
})

const toggleCommentLike = asynHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment
    if(!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid commentId!")
    }

    const likedAlready = await Like.findOne({
        comment: commentId,
        likeBy: req.user._id
    })

    let liked
    let message

    if(!likedAlready) {
        await Like.create({
            comment: commentId,
            likeBy: req.user._id
        })

        liked = true
        message = "Comment liked successfully!"
    } else {
        await likedAlready.deleteOne()

        liked = false
        message = "Comment unliked successfully!"
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, {liked}, message)
    )

})

const toggleTweetLike = asynHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    if(!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId!")
    }

    const likedAlready = await Like.findOne({
        tweet: tweetId,
        likeBy: req.user._id
    })

    let liked
    let message

    if(!likedAlready) {
        await Like.create({
            tweet: tweetId,
            likeBy: req.user._id
        })

        liked = true
        message = "Tweet liked successfully!"
    } else {
        await likedAlready.deleteOne()

        liked = false
        message = "Tweet unliked successfully!"
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, {liked}, message)
    )
    
})

const getLikedVideos = asynHandler(async (req, res) => {
    //TODO: get all liked videos
    const likedVideosAggregate = await Like.aggregate([
        {
            $match: { likeBy: new mongoose.Types.ObjectId(req.user._id) }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideos",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerDetails"
                        }
                    },
                    {
                        $unwind: "$ownerDetails"
                    },
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$likedVideos"
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $project: {
                _id: 0,
                likedVideos: {
                    _id: 1,
                    "thumbnail.url": 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    duration: 1,
                    createdAt: 1,
                    ownerDetails: 1
                }
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, likedVideosAggregate, "Liked videos fetched successfully!")
    )
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}