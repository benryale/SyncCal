import { useState } from 'react'
import { Box, Button, Input, Heading, Text, VStack } from '@chakra-ui/react'

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    let url
    let body

    if (mode === 'login') {
      url = '/api/auth/login/'
      body = { username, password }
    } else {
      url = '/api/auth/register/'
      body = { username, email, password }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
    } else {
      localStorage.setItem('token',data.token);
      onAuth(data)
    }
  }

  return (
    <Box maxW="400px" mx="auto" mt="100px" p="8" borderWidth="1px" borderRadius="lg">
      <Heading mb="6">{mode === 'login' ? 'Login' : 'Register'}</Heading>

      <form onSubmit={submit}>
        <VStack gap="4">
          <Input
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />

          {mode === 'register' && (
            <Input
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          )}

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {error && <Text color="red.500">{error}</Text>}

          <Button type="submit" width="100%" colorScheme="blue">
            {mode === 'login' ? 'Login' : 'Register'}
          </Button>
        </VStack>
      </form>

      <Text mt="4" textAlign="center">
        {mode === 'login'
          ? <span>No account? <a href="#" onClick={() => setMode('register')}>Register</a></span>
          : <span>Have an account? <a href="#" onClick={() => setMode('login')}>Login</a></span>
        }
      </Text>
    </Box>
  )
}

export default AuthPage