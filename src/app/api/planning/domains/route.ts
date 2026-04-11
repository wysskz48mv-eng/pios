import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'

export async function GET(req:NextRequest) {
  try {
    const supabase = await createClient()
    const {data: {user}} = await supabase.auth.getUser()
    if (!user) return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    const {data: domains} = await supabase.from('strategic_domains').select('*').eq('user_id', user.id).order('priority_rank')
    return NextResponse.json({domains})
  } catch (error) {
    return NextResponse.json({error: 'Failed'}, {status: 500})
  }
}

export async function POST(req:NextRequest) {
  try {
    const supabase = await createClient()
    const {data: {user}} = await supabase.auth.getUser()
    if (!user) return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    const {domain_name, description, color_code, priority_rank} = await req.json()
    const {data: domain} = await supabase.from('strategic_domains').insert({user_id: user.id, domain_name, description, color_code, priority_rank: priority_rank || 5, is_active: true}).select().single()
    return NextResponse.json({domain}, {status: 201})
  } catch (error) {
    return NextResponse.json({error: 'Failed'}, {status: 500})
  }
}

export async function PATCH(req:NextRequest) {
  try {
    const supabase = await createClient()
    const {data: {user}} = await supabase.auth.getUser()
    if (!user) return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    const id = new URL(req.url).searchParams.get('id')
    const body = await req.json()
    const {data: domain} = await supabase.from('strategic_domains').update({...body, updated_at: new Date().toISOString()}).eq('id', id).eq('user_id', user.id).select().single()
    return NextResponse.json({domain})
  } catch (error) {
    return NextResponse.json({error: 'Failed'}, {status: 500})
  }
}

export async function DELETE(req:NextRequest) {
  try {
    const supabase = await createClient()
    const {data: {user}} = await supabase.auth.getUser()
    if (!user) return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    const id = new URL(req.url).searchParams.get('id')
    await supabase.from('strategic_domains').update({is_active: false}).eq('id', id).eq('user_id', user.id)
    return NextResponse.json({message: 'Archived'})
  } catch (error) {
    return NextResponse.json({error: 'Failed'}, {status: 500})
  }
}
