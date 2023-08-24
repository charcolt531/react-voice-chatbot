import 'regenerator-runtime/runtime'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMicrophone, faQuoteLeft, faSquare } from '@fortawesome/free-solid-svg-icons'
import React, { useEffect, useState } from 'react'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
import { METHODS } from '@/constants'
import { useTranslation } from 'next-i18next'
import { languageOptions, useLanguage } from './LanguageContext'

let isUserCalling = false
let isChatbotSpeaking = false

export default function CallBob() {
  const commands = [
    {
      command: ['*'],
      callback: (command: string) => handleSend(command),
    },
  ]

  const [isCalling, setIsCalling] = useState(isUserCalling)
  const { transcript, resetTranscript, listening } = useSpeechRecognition({ commands })
  const [speechSynthesis, setSpeechSynthesis] = useState<SpeechSynthesis>()
  const { t } = useTranslation()
  const { selectedLanguage } = useLanguage()
  const defaultIntroduction = t('bob.introduction')
  const defaultMessage = [
    {
      message: defaultIntroduction,
      sender: 'ChatGPT',
    },
  ]
  const [messages, setMessages] = useState(defaultMessage)

  const converSationIdeas: { key: string; title: string; prompt: string }[] = [
    {
      key: 'conversation.fitnessCoach',
      title: t('conversation.fitnessCoach.title'),
      prompt: t('conversation.fitnessCoach.prompt'),
    },
    {
      key: 'conversation.jobInterview',
      title: t('conversation.jobInterview.title'),
      prompt: t('conversation.jobInterview.prompt'),
    },
    {
      key: 'conversation.languagePractice',
      title: t('conversation.languagePractice.title'),
      prompt: t('conversation.languagePractice.prompt', { language: languageOptions[selectedLanguage] }),
    },
    {
      key: 'conversation.knowledgeQuiz',
      title: t('conversation.knowledgeQuiz.title'),
      prompt: t('conversation.knowledgeQuiz.prompt'),
    },
  ]

  // if selectedLanguage changes, reset call
  useEffect(() => {
    endCall()
  }, [defaultIntroduction])

  useEffect(() => {
    setSpeechSynthesis(window.speechSynthesis)
  }, [])

  const chatBotSpeak = (message: string) => {
    if (isChatbotSpeaking || !speechSynthesis || !isUserCalling) {
      return
    }

    if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
      speechSynthesis.speak(new SpeechSynthesisUtterance(t('bob.browserNotSupportSpeechRecognitionMessage')))
      return
    }
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = selectedLanguage
    utterance.onstart = handleChatbotSpeechStart
    utterance.onend = handleChatbotSpeechEnd
    speechSynthesis.speak(utterance)
  }

  const handleChatbotSpeechStart = () => {
    isChatbotSpeaking = true
    SpeechRecognition.stopListening()
  }

  const handleChatbotSpeechEnd = () => {
    if (isUserCalling) {
      SpeechRecognition.startListening({ language: selectedLanguage })
    }
    isChatbotSpeaking = false
  }
  const systemMessageToSetChatGptBehaviour = {
    role: 'system',
    content: t('bob.systemMessage'),
  }

  const handleSend = async (message: string) => {
    if (!message) {
      return
    }
    const formattedMessage = {
      message,
      direction: 'outgoing',
      sender: 'user',
    }

    const updatedMessages = [...messages, formattedMessage]

    setMessages(updatedMessages)

    // Call from conversation ideas
    if (!isUserCalling) {
      isUserCalling = true
      setIsCalling(isUserCalling)
    }
    if (isChatbotSpeaking) {
      speechSynthesis?.cancel()
      isChatbotSpeaking = false
    }
    await getChatGptAnswer(updatedMessages)
  }

  async function getChatGptAnswer(messagesWithSender: { message: string; sender: string }[]) {
    const chatGptApiFormattedMessages = messagesWithSender.map((messageObject) => {
      return {
        role: messageObject.sender === 'ChatGPT' ? 'assistant' : 'user',
        content: messageObject.message,
      }
    })

    const chatGptApiMessages = [
      systemMessageToSetChatGptBehaviour, // The system message DEFINES the logic of our chatGPT
      ...chatGptApiFormattedMessages, // The messages from our chat with ChatGPT
    ]

    try {
      const response = await fetch(`/api/chat/message`, {
        method: METHODS.POST,
        body: JSON.stringify(chatGptApiMessages),
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const data = await response.json()

      const { choices } = data
      setMessages([
        ...messagesWithSender,
        {
          message: choices[0].message.content,
          sender: 'ChatGPT',
        },
      ])
      chatBotSpeak(choices[0].message.content)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const userSpeak = () => {
    SpeechRecognition.startListening({ language: selectedLanguage })

    if (transcript !== '') {
      resetTranscript()
    }
  }
  const userStopSpeaking = () => {
    SpeechRecognition.stopListening()
  }

  const userCall = () => {
    isUserCalling = true
    setIsCalling(isUserCalling)

    if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
      setMessages([
        ...messages,
        {
          message: t('bob.browserNotSupportSpeechRecognitionMessage'),
          sender: 'ChatGPT',
        },
      ])
      isUserCalling = false
      setIsCalling(isUserCalling)
      return
    }

    const firstMessage = t('bob.firstMessage')
    const formattedMessage = {
      message: firstMessage,
      sender: 'assistant',
    }

    const updatedMessages = [...messages, formattedMessage]

    setMessages(updatedMessages)
    chatBotSpeak(firstMessage)
  }

  const resetConversation = () => {
    setMessages(defaultMessage)
  }

  const endCall = () => {
    SpeechRecognition.stopListening()
    resetConversation()
    isUserCalling = false
    setIsCalling(isUserCalling)
    if (isChatbotSpeaking) {
      speechSynthesis?.cancel()
      isChatbotSpeaking = false
    }
    SpeechRecognition.abortListening()
  }

  const callingButtons = React.useMemo(() => {
    return (
      <React.Fragment>
        {listening ? (
          <button className='pb-10 pt-5' onClick={userStopSpeaking}>
            <span className='relative flex h-[60px] w-[60px]'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff5797] '></span>
              <span className='relative inline-flex rounded-full h-[60px] w-[60px] bg-[#fc4189] opacity-15 justify-center items-center'>
                <FontAwesomeIcon icon={faSquare} style={{ color: 'white', fontSize: '25px' }}></FontAwesomeIcon>
              </span>
            </span>
          </button>
        ) : (
          <button className='pb-10 pt-5' onClick={userSpeak}>
            <span className='relative flex h-[60px] w-[60px]'>
              <span className='absolute inline-flex h-full w-full rounded-full bg-gray-300'></span>
              <span className='relative inline-flex rounded-full h-[60px] w-[60px] bg-[#fc4189] opacity-15 justify-center items-center'>
                <FontAwesomeIcon icon={faMicrophone} style={{ color: 'white', fontSize: '25px' }}></FontAwesomeIcon>
              </span>
            </span>
          </button>
        )}

        <button
          className='cursor-pointer outline-none w-[145px] h-[60px] md:text-lg text-white bg-[#ff3482] rounded-full border-none border-r-5 shadow'
          onClick={endCall}
        >
          {t('call.hangUp')}
        </button>
      </React.Fragment>
    )
  }, [listening])

  return (
    <div className='flex lg:flex-row lg:items-center lg:justify-center xs:h-full flex-col items-center justify-end overflow-auto'>
      <div className='bg-[url(../public/Bob.gif)] lg:h-[600px] lg:w-[600px] xs:h-0 w-full bg-no-repeat bg-contain bg-center'></div>
      <div className='flex justify-center flex-col items-center lg:w-[calc(100%-600px)] w-full xs:h-full'>
        <div className='text-xl text-[#433136] font-bold pb-4'>
          <FontAwesomeIcon
            icon={faQuoteLeft}
            style={{ color: 'black', fontSize: '35px', paddingRight: '12px' }}
          ></FontAwesomeIcon>
          {messages[messages.length - 1].message}
        </div>
        <div className='flex justify-center flex-col items-center absolute bottom-7 lg:relative lg:bottom-0'>
          {!isCalling ? (
            <button
              className='cursor-pointer outline-none w-[145px] h-[60px] md:text-lg text-white bg-[#ff3482] rounded-full border-none border-r-5 shadow'
              onClick={userCall}
            >
              {t('call.call')}
            </button>
          ) : (
            callingButtons
          )}
        </div>
        <div className='flex mt-10 w-full overflow-x-auto'>
          {converSationIdeas.map((idea) => (
            <button
              className='bg-[#fdcfe1] border-2 border-[#e64683cf] mr-3 px-3 py-1 last:mr-0 text-black rounded'
              key={idea.key}
              onClick={() => handleSend(idea.prompt)}
            >
              {idea.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
