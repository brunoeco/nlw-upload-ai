import { fastify } from "fastify";
import { fastifyCors } from "@fastify/cors";
import { prisma } from "./lib/prisma";
import { createTranscriptionRoute, generateAICompleteRoute, uploadVideoRoute } from "./routes/videos";
import { getAllPromptsRoute } from "./routes/prompts";

const app = fastify();

app.register(fastifyCors, {
    origin: '*'
})

app.register(uploadVideoRoute)
app.register(createTranscriptionRoute)
app.register(generateAICompleteRoute)
 
app.register(getAllPromptsRoute)

app.listen({
    port: 3333
}).then(() => {
    console.log("Server is running on port 3333.")
})