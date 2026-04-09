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
    // login box
    <Box maxW="400px" mx="auto" mt="100px" p="10" borderRadius="xl" bg="white" boxShadow="2xl" borderWidth="1px" borderColor="gray.100">
      <Heading mb="8" textAlign="center" color="gray.800" fontSize="2xl">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</Heading>

      <form onSubmit={submit}>
        <VStack gap="4">
          <Input
            placeholder="Username"
            bg="white"
            color="black"
            _placeholder={{ color: 'gray.400' }}
            focusBorderColor="blue.500"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />

          {mode === 'register' && (
            <Input
              placeholder="Email"
              value={email}
              bg="white"
              color="black" // black text
              borderColor="gray.300" // gray border
              focusBorderColor="black" // changes blue to black on focus
              _placeholder={{ color: 'gray.400' }}
              onChange={e => setEmail(e.target.value)}
            />
          )}
            <Input
              type="password"
              placeholder="Password"
              value={password}
              bg="white"
              color="black"
              borderColor="gray.300"
              focusBorderColor="black" 
              _placeholder={{ color: 'gray.400' }}
              onChange={e => setPassword(e.target.value)}
            />

          {error && <Text color="red.500">{error}</Text>}

          <Button type="submit" width="100%" colorScheme="blue" size="lg">
            {mode === 'login' ? 'Login' : 'Register'}
          </Button>
        </VStack>
      </form>

      <Text mt="6" textAlign="center" color="gray.700" fontSize="sm">
        {mode === 'login'
          ? <span>No account? <a style={{color: '#3182ce', fontWeight: 'bold'}} href="#" onClick={() => setMode('register')}>Register</a></span>
          : <span>Have an account? <a style={{color: '#3182ce', fontWeight: 'bold'}} href="#" onClick={() => setMode('login')}>Login</a></span>
        }
      </Text>
    </Box>
  )
}

export default AuthPage