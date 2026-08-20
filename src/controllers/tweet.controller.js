import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const { content } = req.body

    if(!content?.trim()) {
        throw new ApiError(400, "Tweet content are required!")
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user._id
    })

    if(!tweet) {
        throw new ApiError(500, "Error uploading tweet, try again!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, tweet, "tweet created")
    )
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params

    if(!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid userId")
    }

    const tweets = await Tweet.aggregate([
        {
            $match: { owner: new mongoose.Types.ObjectId(userId)}
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likes",
                pipeline: [
                    {
                        $project: {
                            likeBy: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                isLiked: {
                    $in: [req.user._id, "$likes.likeBy"]
                }
            }
        },
        {
            $project: {
                content: 1,
                ownerDetails: 1,
                likesCount: 1,
                isLiked: 1
            }
        }

    ])

    if(!tweets.length) {
        throw new ApiError(404, "Tweets not found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, tweets, "user tweets fetched!")
    )
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { content } = req.body
    const { tweetId } = req.params

    if(!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId")
    }

    if(!content?.trim()) {
        throw new ApiError(400, "Tweet content are required!")
    }

    const tweet = await Tweet.findById(tweetId)

    if(!tweet) {
        throw new ApiError(404, "Tweet not found!")
    }

    if(tweet?.owner?.toString() !== req.user._id.toString()) {
        throw new ApiError(400, "only owner can edit their tweet!")
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content
            }
        },
        {
            returnDocument: "after"
        }
    )

    if(!updatedTweet) {
        throw new ApiError(500, "failed to update tweet try again!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedTweet, "Tweet updated successfully!")
    )
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params

    if(!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId")
    }

    const tweet = await Tweet.findById(tweetId)

    if(!tweet) {
        throw new ApiError(404, "Tweet not found!")
    }

    if(tweet?.owner?.toString() !== req.user._id.toString()) {
        throw new ApiError(400, "only owner can delete their tweet!")
    }

    await Tweet.findByIdAndDelete(tweetId)

    return res
    .status(200)
    .json(
        new ApiResponse(200, {tweetId}, "Tweet deleted successfully!")
    )

})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}