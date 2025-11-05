import NextAuth from "next-auth"
import { authOptions } from "../../../../lib/auth"

// NextAuth handler works even with empty providers array
// It will just return no authentication methods available
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
