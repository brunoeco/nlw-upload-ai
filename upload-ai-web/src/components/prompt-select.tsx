import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { api } from "@/lib/axios";

interface Prompt {
    id: string
    title: string
    template: string
}

interface PromptSelectProps {
    onPromptSelect: (template: string) => void
}

export function PromptSelect(props: PromptSelectProps) {
    const [prompts, setPrompts] = useState<Prompt[] | null>(null)

    const handlePromptSelect = (promptId: string) => {
        const selectedPrompt = prompts?.find(prompt => prompt.id === promptId)

        if(!selectedPrompt) {
            return
        }

        props.onPromptSelect(selectedPrompt.template)
    }

    useEffect(() => {
        api.get('/prompts').then((result) => {
            setPrompts(result.data)
        })
    }, [])


    return (
        <Select onValueChange={handlePromptSelect}>
            <SelectTrigger>
                <SelectValue placeholder="Selecione um prompt" />
            </SelectTrigger>

            <SelectContent>
                {prompts?.map(prompt => {
                    return(
                        <SelectItem key={prompt.id} value={prompt.id}>{prompt.title}</SelectItem>
                    )
                })}
            </SelectContent>
        </Select>
    )
}