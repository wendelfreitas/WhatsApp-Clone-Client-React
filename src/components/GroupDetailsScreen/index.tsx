import TextField from '@material-ui/core/TextField'
import { defaultDataIdFromObject } from 'apollo-cache-inmemory'
import gql from 'graphql-tag'
import * as React from 'react'
import { useState, useEffect } from 'react'
import { MutationHookOptions } from 'react-apollo-hooks'
import { useQuery, useMutation } from 'react-apollo-hooks'
import { Redirect } from 'react-router-dom'
import { RouteComponentProps } from 'react-router-dom'
import styled from 'styled-components'
import * as fragments from '../../graphql/fragments'
import { useMe } from '../../services/auth-service'
import { pickPicture, uploadProfilePicture } from '../../services/picture-service'
import { GroupDetailsScreenQuery, GroupDetailsScreenMutation, User } from '../../graphql/types'
import Navbar from '../Navbar'
import CompleteGroupButton from './CompleteGroupButton'
import GroupDetailsNavbar from './GroupDetailsNavbar'

const Style = styled.div `
  .GroupDetailsScreen-group-name {
    width: calc(100% - 30px);
    margin: 15px;
  }

  .GroupDetailsScreen-participants-title {
    margin-top: 10px;
    margin-left: 15px;
  }

  .GroupDetailsScreen-participants-list {
    display: flex;
    overflow: overlay;
    padding: 0;
  }

  .GroupDetailsScreen-participant-item {
    padding: 10px;
    flex-flow: row wrap;
    text-align: center;
  }

  .GroupDetailsScreen-participant-picture {
    flex: 0 1 50px;
    height: 50px;
    width: 50px;
    object-fit: cover;
    border-radius: 50%;
    display: block;
    margin-left: auto;
    margin-right: auto;
  }

  .GroupDetailsScreen-group-info {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .GroupDetailsScreen-participant-name {
    line-height: 10px;
    font-size: 14px;
  }

  .GroupDetailsScreen-group-picture {
    width: 50px;
    flex-basis: 50px;
    border-radius: 50%;
    margin-left: 15px;
    object-fit: cover;
    cursor: pointer;
  }
`

const query = gql `
  query GroupDetailsScreenQuery($chatId: ID!) {
    chat(chatId: $chatId) {
      ...Chat
    }
  }
  ${fragments.chat}
`

const mutation = gql `
  mutation GroupDetailsScreenMutation($chatId: ID!, $name: String, $picture: String) {
    updateChat(chatId: $chatId, name: $name, picture: $picture) {
      ...Chat
    }
  }
  ${fragments.chat}
`

export default ({ location, match, history }: RouteComponentProps) => {
  const chatId = match.params.chatId || ''

  const { data: { me } } = useMe()
  // Not gonna find anything necessarily
  const { data: { chat } } = useQuery<GroupDetailsScreenQuery.Query, GroupDetailsScreenQuery.Variables>(query, {
    variables: { chatId }
  })
  let myId: string
  let chatName: string
  let chatPicture: string
  let ownerId: string
  let users: User.Fragment[]
  let participants: User.Fragment[]

  if (chat) {
    myId = me.id
    chatName = chat.name
    chatPicture = chat.picture
    ownerId = chat.owner.id
    users = chat.allTimeMembers
    participants = users.slice()
  }
  else {
    myId = ''
    chatName = ''
    chatPicture = ''
    ownerId = ''
    users = location.state.users
    participants = [me].concat(users)
  }

  // Users are missing from state
  if (!(users instanceof Array)) {
    return (
      <Redirect to="/chats" />
    )
  }

  // Put me first
  {
    const index = participants.findIndex(participant => participant.id === me.id)
    participants.splice(index, 1)
    participants.unshift(me)
  }

  const [groupName, setGroupName] = useState(chatName)
  const [groupPicture, setGroupPicture] = useState(chatPicture)
  let updateChat: () => any

  if (chat) {
    updateChat = useMutation<GroupDetailsScreenMutation.Mutation, GroupDetailsScreenMutation.Variables>(mutation, {
      optimisticResponse: {
        __typename: 'Mutation',
        updateChat: {
          __typename: 'Chat',
          id: chat.id,
          picture: groupPicture,
          name: groupName,
        }
      },
      update: (client, { data: { updateChat } }) => {
        Object.assign(chat, updateChat)

        client.writeFragment({
          id: defaultDataIdFromObject(chat),
          fragment: fragments.chat,
          data: chat,
        })
      }
    })
  }
  else {
    updateChat = () => {}
  }

  // Update picture once changed
  useEffect(() => {
    if (groupPicture !== chat.picture) {
      updateChat()
    }
  }, [groupPicture])

  const updateGroupName = ({ target }) => {
    setGroupName(target.value)
  }

  const updateChatPicture = async () => {
    // You have to be an admin
    if (ownerId !== myId) return

    const file = await pickPicture()

    if (!file) return

    const { url } = await uploadProfilePicture(file)

    setGroupPicture(url)
  }

  return (
    <Style className="GroupDetailsScreen Screen">
      <Navbar>
        <GroupDetailsNavbar chatId={chatId} history={history} />
      </Navbar>
      <div className="GroupDetailsScreen-group-info">
        <img
          className="GroupDetailsScreen-group-picture"
          src={groupPicture || '/assets/default-group-pic.jpg'}
          onClick={updateChatPicture}
        />
        <TextField
          label="Group name"
          placeholder="Enter group name"
          className="GroupDetailsScreen-group-name"
          value={groupName}
          onChange={updateGroupName}
          onBlur={updateChat}
          disabled={ownerId !== myId}
          autoFocus={true}
        />
      </div>
      <div className="GroupDetailsScreen-participants-title">Participants: {participants.length}</div>
      <ul className="GroupDetailsScreen-participants-list">
        {participants.map(participant => (
          <div key={participant.id} className="GroupDetailsScreen-participant-item">
            <img src={participant.picture || '/assets/default-profile-pic.jpg'} className="GroupDetailsScreen-participant-picture" />
            <span className="GroupDetailsScreen-participant-name">{participant.name}</span>
          </div>
        ))}
      </ul>
      {!chatId && groupName && <CompleteGroupButton history={history} groupName={groupName} groupPicture={groupPicture} users={users} />}
    </Style>
  )
}
