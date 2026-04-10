import { useState, useEffect, useRef } from 'react'
import { Box, Button, Text } from '@chakra-ui/react'
import { Users, Check, X } from 'lucide-react'
import axios from 'axios'

function FriendList({ user, visibleFriends = [], onVisibleFriendsChange = () => {} }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('requests') // 'requests' | 'friends'
  const [pendingRequests, setPendingRequests] = useState([])
  const [friends, setFriends] = useState([])
  const containerRef = useRef(null)

  // Fetch pending requests and friends whenever dropdown opens
  useEffect(() => {
    if (!user || !open) return
    fetchPending()
    fetchFriends()
  }, [user, open])

  // Poll for new requests every 30 seconds while logged in
  useEffect(() => {
    if (!user) return
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchPending() {
    try {
      const res = await axios.get('/api/friends/requests/')
      setPendingRequests(res.data)
    } catch { /* ignore */ }
  }

  async function fetchFriends() {
    try {
      const res = await axios.get('/api/friends/')
      setFriends(res.data)
    } catch { /* ignore */ }
  }

  async function respond(requestId, action) {
    try {
      await axios.post(`/api/friends/request/${requestId}/respond/`, { action })
      // Remove from pending list
      setPendingRequests(prev => prev.filter(r => r.id !== requestId))
      // If accepted, refresh friends
      if (action === 'accept') fetchFriends()
    } catch { /* ignore */ }
  }

  if (!user) return null

  return (
    <Box ref={containerRef} position="relative">
      {/* Friend icon with badge */}
      <Box
        as="button"
        position="relative"
        p="1"
        borderRadius="md"
        _hover={{ bg: 'gray.100' }}
        onClick={() => setOpen(prev => !prev)}
        cursor="pointer"
        display="flex"
        alignItems="center"
      >
        <Users size={20} color="#4A5568" />
        {pendingRequests.length > 0 && (
          <Box
            position="absolute"
            top="-2px"
            right="-2px"
            bg="red.500"
            color="white"
            fontSize="10px"
            fontWeight="700"
            borderRadius="full"
            w="16px"
            h="16px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            lineHeight="1"
          >
            {pendingRequests.length}
          </Box>
        )}
      </Box>

      {/* Dropdown */}
      {open && (
        <Box
          position="absolute"
          top="calc(100% + 8px)"
          right="0"
          w="300px"
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          boxShadow="lg"
          zIndex="dropdown"
          overflow="hidden"
        >
          {/* Tabs */}
          <Box display="flex" borderBottom="1px solid" borderColor="gray.100">
            <Box
              as="button"
              flex="1"
              py="2"
              fontSize="sm"
              fontWeight={tab === 'requests' ? '600' : '400'}
              color={tab === 'requests' ? 'blue.600' : 'gray.500'}
              borderBottom={tab === 'requests' ? '2px solid' : '2px solid transparent'}
              borderColor={tab === 'requests' ? 'blue.600' : 'transparent'}
              bg="transparent"
              cursor="pointer"
              onClick={() => setTab('requests')}
            >
              Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </Box>
            <Box
              as="button"
              flex="1"
              py="2"
              fontSize="sm"
              fontWeight={tab === 'friends' ? '600' : '400'}
              color={tab === 'friends' ? 'blue.600' : 'gray.500'}
              borderBottom={tab === 'friends' ? '2px solid' : '2px solid transparent'}
              borderColor={tab === 'friends' ? 'blue.600' : 'transparent'}
              bg="transparent"
              cursor="pointer"
              onClick={() => setTab('friends')}
            >
              Friends {friends.length > 0 && `(${friends.length})`}
            </Box>
          </Box>

          {/* Content */}
          <Box maxH="280px" overflowY="auto">
            {tab === 'requests' && (
              pendingRequests.length === 0 ? (
                <Box px="4" py="6" textAlign="center">
                  <Text fontSize="sm" color="gray.400">No pending requests</Text>
                </Box>
              ) : (
                pendingRequests.map(req => (
                  <Box
                    key={req.id}
                    px="3"
                    py="2.5"
                    display="flex"
                    alignItems="center"
                    gap="2"
                    _hover={{ bg: 'gray.50' }}
                  >
                    <Box
                      w="30px"
                      h="30px"
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
                      {req.from_username[0].toUpperCase()}
                    </Box>
                    <Box flex="1">
                      <Text fontSize="sm" fontWeight="500" color="gray.800">
                        {req.from_username}
                      </Text>
                      <Text fontSize="xs" color="gray.400">
                        wants to be your friend
                      </Text>
                    </Box>
                    <Box display="flex" gap="1">
                      <Button
                        size="xs"
                        bg="green.500"
                        color="white"
                        _hover={{ bg: 'green.600' }}
                        px="2"
                        minW="auto"
                        onClick={() => respond(req.id, 'accept')}
                      >
                        <Check size={14} />
                      </Button>
                      <Button
                        size="xs"
                        bg="red.500"
                        color="white"
                        _hover={{ bg: 'red.600' }}
                        px="2"
                        minW="auto"
                        onClick={() => respond(req.id, 'decline')}
                      >
                        <X size={14} />
                      </Button>
                    </Box>
                  </Box>
                ))
              )
            )}

            {tab === 'friends' && (
              friends.length === 0 ? (
                <Box px="4" py="6" textAlign="center">
                  <Text fontSize="sm" color="gray.400">No friends yet</Text>
                </Box>
              ) : (
                friends.map(f => (
                  <Box
                    key={f.id}
                    px="3"
                    py="2.5"
                    display="flex"
                    alignItems="center"
                    gap="2"
                    _hover={{ bg: 'gray.50' }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleFriends.includes(f.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onVisibleFriendsChange([...visibleFriends, f.id])
                        } else {
                          onVisibleFriendsChange(visibleFriends.filter(id => id !== f.id))
                        }
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <Box
                      w="30px"
                      h="30px"
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
                      {f.username[0].toUpperCase()}
                    </Box>
                    <Text fontSize="sm" fontWeight="500" color="gray.800">
                      {f.username}
                    </Text>
                  </Box>
                ))
              )
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}

export default FriendList
