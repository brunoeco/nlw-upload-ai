import { FastifyInstance } from "fastify";
import { fastifyMultipart } from "@fastify/multipart";
import { prisma } from "../lib/prisma";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream";
import { z } from "zod";
import { openai } from "../lib/openai";
import { streamToResponse, OpenAIStream } from "ai";

const pump = promisify(pipeline);

export async function uploadVideoRoute(app: FastifyInstance) {
    app.register(fastifyMultipart, {
        limits: {
            fileSize: 1_048_576 * 25
        }
    })

    app.post('/videos', async (req, res) => {
        const data = await req.file()

        if(!data) {
            return res.status(400).send({error: "Missing file input."})
        }

        const extension = path.extname(data.filename)

        if(extension !== '.mp3') {
            return res.status(400).send({error: "Invalid input type, please upload a MP3."})
        }

        const fileBaseName = path.basename(data.filename, extension)
        const fileUploadName = `${fileBaseName}${randomUUID()}${extension}`
        const uploadDestination = path.resolve(__dirname, '../../tmp', fileUploadName)

        await pump(data.file, createWriteStream(uploadDestination))

        const video = await prisma.video.create({
            data: {
                name: data.filename,
                path:uploadDestination
            }
        })

        return res.send(video);
    })
}

export async function createTranscriptionRoute(app: FastifyInstance) {
    app.post('/videos/:videoId/transcription', async (req, res) => {
        const paramsSchema = z.object({
            videoId: z.string().uuid()
        })

        const {videoId} = paramsSchema.parse(req.params)

        const bodySchema = z.object({
            prompt: z.string()
        })

        const {prompt} = bodySchema.parse(req.body)

        const video = await prisma.video.findUniqueOrThrow({
            where: {
                id: videoId
            }
        })

        const videoPath = video.path
        const audioReadStream = createReadStream(videoPath)

        console.log({
            file: audioReadStream,
            model: "whisper-1",
            language: "pt",
            response_format: "json",
            temperature: 0,
            prompt
        })

        const response = await openai.audio.transcriptions.create({
            file: audioReadStream,
            model: "whisper-1",
            language: "pt",
            response_format: "json",
            temperature: 0,
            prompt
        }).catch((err) => {
            console.log(err)

            return res.send({error: "Transcription error."})
        })

        await prisma.video.update({
            where: {
                id: videoId
            },
            data: {
                transcription: response.text
            }
        }).catch((err) => {
            console.log(err)

            return res.send({error: "Update video error."})
        })

        return res.send({
            transcription: response.text
        })
    })
}

export async function generateAICompleteRoute(app: FastifyInstance) {
    app.post('/ai/complete', async (req, res) => {
        const bodySchema = z.object({
            videoId: z.string().uuid(),
            prompt: z.string(),
            temperature: z.number().max(1).min(0).default(0.5)
        })

        const {videoId, prompt, temperature} = bodySchema.parse(req.body)

        const video = await prisma.video.findUniqueOrThrow({
            where: {
                id: videoId
            }
        })

        if(!video.transcription) {
            return res.status(400).send({error:"Video transcription was not generated yet."})
        }

        const promptMessage = prompt.replace('{transcription}', video.transcription)

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo-16k',
            temperature,
            messages: [
                {role: 'user', content: promptMessage}
            ],
            stream: true
        })

        const stream = OpenAIStream(response)

        streamToResponse(stream, res.raw, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST'
            }
        })
    })
}