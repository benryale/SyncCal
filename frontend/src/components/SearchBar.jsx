import { useState, useEffect, useRef } from 'react'
import { Box, Text, Input, Button } from '@chakra-ui/react'
import { Search, UserPlus, UserCheck, Clock } from 'lucide-react'
import axios from 'axios'

function SearchBar({ user }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  // Track pending request state per user id: 'none' | 'pending' | 'accepted'
  const [requestStates, setRequestStates] = useState({})
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await axios.get(`/api/users/search/?q=${encodeURIComponent(query)}`)
        setResults(res.data)
        // Seed requestStates from server-provided friend_status
        const states = {}
        res.data.forEach(u => { states[u.id] = u.friend_status ?? 'none' })
        setRequestStates(prev => ({ ...prev, ...states }))
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleAddFriend(toUserId) {
    setRequestStates(prev => ({ ...prev, [toUserId]: 'pending' }))
    try {
      await axios.post('/api/friends/request/', { to_user_id: toUserId })
    } catch {
      // Revert on error
      setRequestStates(prev => ({ ...prev, [toUserId]: 'none' }))
    }
  }

  function FriendButton({ userId }) {
    const status = requestStates[userId] ?? 'none'
    if (!user) return null

    if (status === 'accepted') {
      return (
        <Button size="xs" variant="ghost" colorScheme="green" disabled px="2" gap="1">
          <UserCheck size={13} /> Friends
        </Button>
      )
    }
    if (status === 'pending') {
      return (
        <Button size="xs" variant="ghost" colorScheme="gray" disabled px="2" gap="1">
          <Clock size={13} /> Pending
        </Button>
      )
    }
    return (
      <Button
        size="xs"
        variant="outline"
        colorScheme="blue"
        px="2"
        gap="1"
        onClick={(e) => { e.stopPropagation(); handleAddFriend(userId) }}
      >
        <UserPlus size={13} /> Add
      </Button>
    )
  }

  return (
    <Box ref={containerRef} position="relative" w="280px">
      <Box position="relative">
        <Box
          position="absolute"
          left="10px"
          top="50%"
          transform="translateY(-50%)"
          pointerEvents="none"
          color="gray.400"
        >
          <Search size={15} />
        </Box>
        <Input
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          size="sm"
          pl="32px"
          bg="gray.50"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          _focus={{ borderColor: 'blue.400', bg: 'white' }}
        />
      </Box>

      {open && (
        <Box
          position="absolute"
          top="calc(100% + 4px)"
          left="0"
          right="0"
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          boxShadow="md"
          zIndex="dropdown"
          maxH="240px"
          overflowY="auto"
        >
          {loading ? (
            <Box px="3" py="2">
              <Text fontSize="sm" color="gray.400">Searching...</Text>
            </Box>
          ) : results.length === 0 ? (
            <Box px="3" py="2">
              <Text fontSize="sm" color="gray.400">No users found</Text>
            </Box>
          ) : (
            results.map((u) => (
              <Box
                key={u.id}
                px="3"
                py="2"
                display="flex"
                alignItems="center"
                gap="2"
                _hover={{ bg: 'gray.50' }}
              >
                <Box
                  w="26px"
                  h="26px"
                  borderRadius="full"
                  bg="blue.50"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize="xs"
                  fontWeight="600"
                  color="blue.700"
                  flexShrink="0"
                >
                  {u.username[0].toUpperCase()}
                </Box>
                <Box flex="1">
                  <Text fontSize="sm" fontWeight="500" color="gray.800">
                    {u.username}
                  </Text>
                  {u.email && (
                    <Text fontSize="xs" color="gray.400">
                      {u.email}
                    </Text>
                  )}
                </Box>
                <FriendButton userId={u.id} />
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  )
}

export default SearchBar
