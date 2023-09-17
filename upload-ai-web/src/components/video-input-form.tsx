import { useState, ChangeEvent, useMemo, useRef, FormEvent } from "react";
import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

interface VideoInputFormProps {
    onVideoUploaded: (videoId: string) => void;
}

type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'
const statusMessage = {
    converting: 'Conventendo...',
    uploading: 'Carregando...',
    generating: 'Transcrevendo...',
    success: 'Sucesso!'
}

export function VideoInputForm(props: VideoInputFormProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [status, setStatus] = useState<Status>('waiting');
    const promptRef = useRef<HTMLTextAreaElement>(null)

    const convertVideoToAudio = async (video: File) => {
        console.log('Convert started.')

        const ffmpeg = await getFFmpeg()

        await ffmpeg.writeFile('input.mp4', await fetchFile(video))

        ffmpeg.on('progress', progress => {
            console.log('Convert progress: ' + Math.round(progress.progress * 100))
        })

        await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:a',
            '-b:a',
            '20k',
            '-acodec',
            'libmp3lame',
            'output.mp3',
        ])

        const data = await ffmpeg.readFile('output.mp3')

        const audioFileBlob = new Blob([data], { type: 'audio/mpeg' })
        const audioFile = new File([audioFileBlob], 'audio.mp3', {
            type: 'audio/mpeg',
        })

        console.log('Convert finished.')

        return audioFile
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const prompt = promptRef.current?.value;

        if(!videoFile) {
            return
        }

        setStatus('converting')

        const audioFile = await convertVideoToAudio(videoFile)

        const data = new FormData();

        setStatus('uploading')

        data.append('file', audioFile)

        const response = await api.post("/videos", data)

        setStatus('generating')

        const videoId = response.data.id

        await api.post(`/videos/${videoId}/transcription`, {
            prompt,
        })

        setStatus('success')
        
        props.onVideoUploaded(videoId)
    }
  
    const handleSelectVideo = (event: ChangeEvent<HTMLInputElement>) => {
      const {files} = event.target;

      if(!files || !files[0]) {
        return
      }
  
      setVideoFile(files[0])
    }

    const previewUrl = useMemo(() => {
        if(!videoFile) {
            return null
        }

        return URL.createObjectURL(videoFile);
    }, [videoFile])
    
    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <label htmlFor="video" className="relative border flex items-center justify-center overflow-hidden gap-2 rounded-md aspect-video cursor-pointer hover:bg-primary/5">
                {previewUrl ? (
                    <video src={previewUrl} controls={false} className="pointer-events-none absolute inset-0"></video>  
                ) : (
                    <>
                        <FileVideo className="w-4 h-4" />
                        Selecione um vídeo
                    </>
                )}
            </label>

            <input type="file" id="video" accept="video/mp4" className="sr-only" onChange={handleSelectVideo} />

            <Separator />

            <div className="space-y-1">
                <Label htmlFor="transcription_prompt">Prompt de transcrição</Label>
                <Textarea 
                    disabled={status !== 'waiting'}
                    ref={promptRef}
                    id="transcription_prompt"
                    className="min-h-0 leading-relaxed"
                    placeholder="Inclua palavras-chave mencionadas no vídeo separadas por vírgula (,)"
                />
            </div>

            <Button data-success={status==='success'} disabled={status !== 'waiting'} className="w-full data-[success=true]:bg-emerald-400" type="submit">
                {status === "waiting" ? (
                    <>
                        Carregar vídeo
                        <Upload className="w-4 h-4 ml-2" />
                    </>
                ) : statusMessage[status]}
            </Button>

        </form>
    )
}