import { Box, Button, Text } from '@chakra-ui/react'
import { CalendarSync } from 'lucide-react';
import SearchBar from './SearchBar';


function NavBar({ user, onLogout, onLoginClick }) {
  return (
    <Box bg="white" borderBottom="1px solid" borderColor="gray.100"
      px="6" h="56px" display="flex" alignItems="center" justifyContent="space-between">
      
      <Button variant="ghost" size="lg" _hover={{ bg: 'transparent' }} p="0" onClick={() => window.location.href = '/'}>
        <CalendarSync size={24} color="#1a2744" style={{ marginLeft: '4px' }} />
        <Text fontSize="lg" fontWeight="500" color="gray.800">SyncCal</Text>
      </Button>

      <SearchBar user={user} />

      <Box display="flex" alignItems="center" gap="3">
        {user ? (
          <>
            <Box w="30px" h="30px" borderRadius="full" bg="blue.50"
              display="flex" alignItems="center" justifyContent="center"
              fontSize="xs" fontWeight="500" color="blue.700">
              {user.username[0].toUpperCase()}
            </Box>
            <Text fontSize="sm" color="gray.500">{user.username}</Text>
            <Button size="sm" variant="outline" onClick={onLogout}>
              Sign out
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onLoginClick}
            bg="#1a2744" color="white">
            Sign In
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default NavBar