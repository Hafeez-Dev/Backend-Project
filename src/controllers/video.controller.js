import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
})

const publishAVideo = asyncHandler(async (req, res) => {
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

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID!")
    }

    const videoFile = await Video.aggregate([
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
            $addFields: {
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
                videoFile: 1,
                thumbnail: 1,
                duration: 1,
                views: 1,
                owner: {
                    _id: 1,
                    username: 1,
                    avatar: 1,
                    fullName: 1,
                    subscribersCount: 1,
                    isSubscribed: 1
                }

            }
        }
    ])

    if(!videoFile?.length) {
        throw new ApiError(404, "video not found!")
    }
    
    return res
    .status(200)
    .json(
        new ApiResponse(200, videoFile[0], "Video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
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
    

    await Video.findByIdAndUpdate(
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

    await deleteFromCloudinary(thumbnailPublicId)

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Video updated sccessfully!")
    )


})

const deleteVideo = asyncHandler(async (req, res) => {
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

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)) {
        throw new ApiError(404, "Invalid user ID !")
    }

    const video = await Video.findById(videoId)

    if(video.isPublished === false){
        await Video.updateOne(
            { _id: videoId },
            {
                $set: {
                    isPublished: true
                }
            }
        )
    } else {
        await video.updateOne(
            { _id: videoId },
            {
                $set: {
                    isPublished: false
                }
            }
        )
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Toggled publishe status!")
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