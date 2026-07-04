export default {
  async fetch(): Promise<Response> {
    return new Response('meowbench vote worker', { status: 200 })
  },
}
