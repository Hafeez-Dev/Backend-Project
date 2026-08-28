import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asynHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asynHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    const pipeline = []

    if(query) {
        pipeline.push(
            {
                $match: {
                    $or: [
                        {title: {$regex: query, $options: "i"}},
                        {description: {$regex: query, $options: "i"}},
                    ]
                }
            }
        )
    }

    if(userId) {
        if(!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId")
        }

        pipeline.push({
            $match: { 
                owner: new mongoose.Types.ObjectId(userId)
            }
        })
    }

    //fetch only that are set isPublished as true
    pipeline.push({ $match: { isPublished: true }})

    //sortBy can be views, createdAt, duration
    //sortType can be ascending(1) or decending(-1)
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        })
    } else {
        pipeline.push({ $sort: { createdAt: -1 } })
    }

    pipeline.push(
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
        }
    )

    const videoAggregate = Video.aggregate(pipeline)

    const options = {
        limit: parseInt(limit, 10),
        page: parseInt(page, 10)
    }

    const videos = await Video.aggregatePaginate(videoAggregate, options)

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, videos, "Videos fetched successfully!"
        )
    )

})

const publishAVideo = asynHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video

    if([title, description].some(field => field.trim() === "")) {
        throw new ApiError(400, "All fields are required!")
    }

    const videoLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    if(!videoLocalPath || !thumbnailLocalPath) {
        throw new ApiError(400, "Both files are required!")
    }

    const video = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if(!thumbnail.url || !video.url ){
        throw new ApiError(500, "Video failed during upload!")
    }

    const uploadedVideo = await Video.create({
        videoFile: {
            url: video?.url,
            public_id: video?.public_id
        },
        thumbnail: {
            url: thumbnail?.url,
            public_id: thumbnail?.public_id
        },
        title,
        description,
        duration: video.duration,
        owner: req.user?._id

    })

    return res
    .status(200)
    .json(
        new ApiResponse(200, uploadedVideo, "VideoFile uploaded successfully" )
    )
})

const getVideoById = asynHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID!")
    }

    const video = await Video.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(videoId) }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $unwind: "$owner"
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "owner._id",
                foreignField: "channel",
                as: "subscribers"
            }
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
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                isLiked: {
                    $in: [
                        req.user?._id, "$likes.likeBy"
                    ]
                },
                "owner.subscribersCount": {
                    $size: "$subscribers"
                },
                "owner.isSubscribed": {
                        $in: [
                            req.user?._id, "$subscribers.subscriber"
                        ]
                }
            }
        },
        {
            $project: {
                title: 1,
                description: 1,
                "videoFile.url": 1,
                "thumbnail.url": 1,
                duration: 1,
                views: 1,
                owner: {
                    _id: 1,
                    username: 1,
                    "avatar.url": 1,
                    fullName: 1,
                    subscribersCount: 1,
                    isSubscribed: 1
                },
                likesCount: 1,
                isLiked: 1

            }
        }
    ])

    if(!video?.length) {
        throw new ApiError(404, "video not found!")
    }

    // increment views if video fetched successfully
    await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: {
                views: 1
            }
        }
    )

    // add this video to user watchHistory
    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $addToSet: {
                watchHistory: videoId
            }
        }
    )

    
    return res
    .status(200)
    .json(
        new ApiResponse(200, video[0], "Video fetched successfully")
    )
})

const updateVideo = asynHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body
    //TODO: update video details like title, description, thumbnail
    if(!isValidObjectId(videoId)) {
        throw new ApiError(404, "Invalid user ID!")
    }
    
    const thumbnailLocalPath = req.file?.path
    const updatedThumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if(!updatedThumbnail.url) {
        throw new ApiError(500, "Error while uploading video to cloudinary!")
    }

    const video = await Video.findById(videoId).select("thumbnail")
    const thumbnailPublicId = video.thumbnail?.public_id
    

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {
                    url: updatedThumbnail?.url,
                    public_id: updatedThumbnail?.public_id
                }
            }
        },
        {
            returnDocument: "after"
        }
    )

    if(!updatedVideo) {
        throw new ApiError(500, "Failed to update video please try again")
    }

    if(updatedVideo) {
        await deleteFromCloudinary(thumbnailPublicId)
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedVideo, "Video updated sccessfully!")
    )


})

const deleteVideo = asynHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    const video = await Video.findById(videoId)

    if(!video) {
        throw new ApiError(404, "video not found!")
    }

    const thumbnailPublicId = video.thumbnail?.public_id
    const videoFilePublicId = video.videoFile?.public_id

    await Video.deleteOne({
        _id: videoId
    })

    await deleteFromCloudinary(thumbnailPublicId)
    await deleteFromCloudinary(videoFilePublicId)

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Video deleted successfully")
    )
})

const togglePublishStatus = asynHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID !")
    }

    const video = await Video.findById(videoId)

    if(!video) {
        throw new ApiError(404, "Video not found!")
    }

    const toggleVideoPublish = await Video.findByIdAndUpdate(
            videoId,
            {
                $set: {
                    isPublished: !video.isPublished
                }
            },
            {
                returnDocument: "after",
                projection: { isPublished: 1 }
            }
            
        )


    return res
    .status(200)
    .json(
        new ApiResponse(200,toggleVideoPublish, "Video publish toggled successfully!")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}