import { asynHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


const generateAccessAndRefreshTokens = async (userId) =>
{
    try {
        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError( 500, "something went wrong while generating Access and Refresh Token")
    }
}


const registerUser = asynHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary
    // create user Object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {username, fullName, email, password} = req.body
    // console.log("Requested Body:", req.body);
    
    if ([username, fullName, email, password].some( field => field?.trim() ==="")) {
        throw new ApiError(400, "All fields are required!")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exisit!")
    }

    // console.log("Requested Files:", req.files);
    
    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required!")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar is file is required!")
    }

    const user = await User.create({
        fullName,
        avatar: {
            url: avatar.url,
            public_id: avatar.public_id
        },
        coverImage: {
            url: coverImage?.url || "",
            public_id: coverImage?.public_id || ""
        },
        username,
        email,
        password

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Error while registering user!")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully!")
    )

} )

const logginUser = asynHandler( async (req, res) => {
    // req body -> data
    // username or email
    // find the user
    // password check
    // access refresh token
    // send cookie

    const { username, email, password } = req.body;

    if(!(username || email) ) {
        throw new ApiError( 400, "username or email is required!" )
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(!user) {
        throw new ApiError( 404, "user not found!" )
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) {
        throw new ApiError( 401, "Invalid user credentials!" )
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully!"
        )
    )
    
})

const logoutUser = asynHandler( async (req, res) => {
    // find the user (_id)
    // update doc -> reset refreshToken
    // logout and clear all cookies and response

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1  // this removes the field from the document
            }
        },
        {
            returnDocument: "after"
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json( new ApiResponse(200, {}, "user loggedout successfully!"))

})

const refreshAccessToken = asynHandler( async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken

        if(!incomingRefreshToken) {
            throw new ApiError(401, "unauthorized request!")
        }

        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "refresh token is expired or used!")
        }
        
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken},
                "Access token refreshed!"
            )
        )

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asynHandler( async (req, res) => {
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Ivalid old password!")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    res
    .status(200)
    .json( new ApiResponse(200, {}, "Password changed successfully!"))
})

const getCurrentUser = asynHandler( async (req, res) => {
    res
    .status(200)
    .json(new ApiResponse( 
        200, 
        req.user, 
        "user fetched successfully!"
    ))
})

const updateAccountDetails = asynHandler( async (req, res) => {
    const { fullName, email } = req.body

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required!")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            returnDocument: "after"
        }
    ).select("-password")

    res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully!"))
})

const updateUserAvatar = asynHandler( async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required!")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) {
        throw new ApiError(500, "Error while uploading on cloudinary!")
    }

    const user = await User.findById(req.user?._id).select("avatar")

    //TODO: delete old image - assignment
    await deleteFromCloudinary(user.avatar?.public_id)

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: {
                    url: avatar.url,
                    public_id: avatar.public_id
                }
            }
        },
        {
            returnDocument: "after"
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedUser, "Avatar image updated successfully")
    )

})

const updateUserCoverImage = asynHandler( async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) {
        throw new ApiError(400, "cover image file is missing!")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url) {
        throw new ApiError(500, "Error while uploading on cloudinary!")
    }

    const user = await User.findById(req.user?._id).select("coverImage")

    //TODO: delete old image - assignment
    await deleteFromCloudinary(user.coverImage?.public_id)

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: {
                    url: coverImage.url,
                    public_id: coverImage.public_id
                }
            }
        },
        {
            returnDocument: "after"
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedUser, "coverImage image updated successfully")
    )

})

const getUserChannelProfile = asynHandler( async (req, res) => {
    const {username} = req.params

    if(!username?.trim()) {
        throw new ApiError(400, "username is missing!")
    }

    const channel = await User.aggregate([
        {
            $match: {username: username?.toLowerCase()}
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscriber"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscriber"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, '@subscribers.subscriber']},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1


            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, 'channel does not exists')
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully!")
    )
})

const getWatchHistory = asynHandler( async (req, res) => {
    const user = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(req.user?._id) }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, 
            user[0].watchHistory,
            "History fetched successfully!"
        )
    )
})

export {
    registerUser,
    logginUser,
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}