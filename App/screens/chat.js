import React, {Component} from 'react';
import Styles from './styles/chat'
import {FlatList, Text, View, TouchableHighlight, KeyboardAvoidingView, Platform, ScrollView, Keyboard} from 'react-native';
import {Message} from 'sosa-chat-client';

import Session from "../sosa/Session";

import Helpers from '../sosa/Helpers';
import {MessageInput} from "../components/MessageInput";
import {UserList} from "../components/chat/UserList";

import {RoomItem} from "../components/chat/RoomItem";

import withMembersNavigationContext from "./hoc/withMembersNavigationContext";

import {ProfileModal} from "../components/ProfileModal";
import {MessageItem} from "../components/chat/MessageItem";

import {parseString as parseXMLString} from "react-native-xml2js";

import ImagePicker from "react-native-image-picker";

export class Chat extends Component {
	drawerNavigationContext = {};
	membersNavigationContext = {};

	navigation = {};
	drawerNavigation = {};

	scrollOffset = {y:0, x:0};
	scrollView = null;
	username = '';
	messageBuffer = [];
	nickname = '';
	coolDown = false;
	coolDownTimer = null;
	slowDownCounter = 0;
	slowDownTimer = null;
	tagPosition = {start:0, end:0};
	messageInputPosition = {start:0, end:0};

	messageInput = ''; //We use this as well as state because setState doesn't update immediately and can create a race condition

	apiMiddleware;
	apiClient;
	session;

	bufferRenderTimer = null;
	bufferRenderRunning = false;

	selectedProfile = null;
	componentMounted = false;


	state = {
		userList: [],
		messages: [],
		tagSearchData: [],
		messageInput: '',
		rooms: [],
		scrolling: true,
		newMessagesNotificationVisible: false,
		slowDownNotifierVisible: false,
		currentRoom: null,
		canSend: true,
		fuckWith: false,
		profileModalVisible: false,
		uploading:false,
		preferences: {
			touch_face_for_profile: false,
			show_separators: false,
			show_slim: false
		}
	};

	constructor(props) {
		super();

		const {navigation, navigationContext} = props;
		const {drawerNavigation, drawerNavigationContext} = navigationContext;
		const {appContext} = drawerNavigationContext;
		const {addListener} = navigationContext;
		const {client: apiClient} = appContext;
		const {middleware: apiMiddleware} = apiClient;

		this.session = Session.getInstance();

		this.navigation = navigation;
		this.drawerNavigation = drawerNavigation;

		this.membersNavigationContext = navigationContext;
		this.drawerNavigationContext = drawerNavigationContext;

		this.appContext = appContext;
		this.apiClient = apiClient;
		this.apiMiddleware = apiMiddleware;

		addListener('settings_update', (preferences) => this.preferencesChanged(preferences));
		addListener('api_authenticated', (authData) => {
			this.setupChat();
		})
	}

	componentDidMount() {
		this.componentMounted = true;
		this.updateUserList();
		this.preferencesChanged(this.membersNavigationContext.preferences);
		this.setupChat();
	}

	componentWillUnmount(): void {
		this.componentMounted = false;
		//this.apiClient.middleware.clear();
	}

	addListeners = () => {
		this.apiMiddleware.add({
			'receive_message': (message, client) => {
				this.addMessage(message);
				return message;
			},
			'disconnected': (message, client) => {
				clearTimeout(this.bufferRenderTimer);
				this.addStatus('Disconnected from server');
				return message;
			},
			'rooms/join': (userData) => {
				if(this.state.currentRoom){

					this.addStatus(`${userData.nickname} joined`);

					let userList = this.state.userList;
					let add = true;
					userList.forEach((user, index) => {
						if(user.nickname === userData.nickname) add = false;
					});
					if(add){
						userList.push(userData);
						this.sortUserList(userList);
						this.setState({userList: userList});
					}
				}
			},
			'rooms/left': (userData) => {
				if(this.state.currentRoom){
					this.addStatus(`${userData.nickname} left`);
					let userList = this.state.userList;

					userList.forEach((user, index) => {
						if(user.nickname === userData.nickname) delete userList[index];
					});
					this.sortUserList(userList);
					this.setState({userList: userList});
				}
			}
		});
	}

	setupChat() {
		if(this.apiClient.connected && this.apiClient.authenticated){
			this.addListeners();
			this.addStatus(`Connected to server with nickname: ${this.session.nickname}`);

			this.setupBufferRenderTimer();
			this.updateRoomList();

			if(this.state.currentRoom !== null){
				this.joinRoom(this.state.currentRoom.community_id, this.state.currentRoom.name);
			}else{
				this.joinRoom('sosa', 'general');
			}
		}
	}

	preferencesChanged(preferences){
		let stateChanges = this.state.preferences;
		let updateState = false;

		for(let key in preferences){
			if(preferences.hasOwnProperty(key)){
				let value = preferences[key];
				if(key.startsWith('chat:')){
					key = key.replace('chat:','');
					if(!stateChanges.hasOwnProperty(key) || value !== stateChanges[key]){
						updateState = true;
						stateChanges[key] = value;
					}
				}
			}
		}
		if(updateState) this.setState(stateChanges);
	}

	updateUserList = () => {
		this.drawerNavigationContext.addDrawerItem('user_list', (
			<View style={{flex:1}} key={'user_list'}>
				<UserList userList={this.state.userList} onPress={
					(user) => {
						this.drawerNavigation.closeDrawer();
						this.addTag(user.nickname);
					}} />
			</View>
		), true);
	}

	sendMessage = () => {
		if(!this.coolDown && this.slowDownCounter < 3){
			let message = this.messageInput.trim();
			if(message.length > 0){
				this.coolDown = true;

				clearTimeout(this.coolDownTimer);
				clearTimeout(this.slowDownTimer);

				this.coolDownTimer = setTimeout(() => this.coolDown = false, this.slowDownCounter * 200);
				this.slowDownTimer = setTimeout(() => {
					this.slowDownCounter = 0;
					this.setState({slowDownNotifierVisible: false, canSend: true, fuckWith: false});
				},5000);
				this.slowDownCounter++;

				this.apiClient.rooms().send((err, message) => {
						if(!err) this.addMessage(message);
					},
					this.state.currentRoom.community_id,
					this.state.currentRoom.name,
					message
				);
				this.setMessageInput('');
				this.scrollToBottom();
			}
		}else{
			this.slowDownCounter++;

			if(this.slowDownCounter > 3){
				let data = {slowDownNotifierVisible: true, canSend: false};
				if(this.slowDownCounter > 4) data.fuckWith = true;

				this.setState(data);
			}
		}
	};

	addStatus = (message) => {
		this.addMessage({id: Helpers.generateId(), message: message});
	};

	addMessage = (item) => {
		if(this.componentMounted){
			if(!item.id){
				if(item.uuid){item.id = item.uuid;}
				else if(item._id){
					item.id = item._id;
				}else{
					item.id = Helpers.generateId();
				}
			}
			this.messageBuffer.push(item);

			if(this.isScrolled() && !this.state.newMessagesNotificationVisible){
				this.setState({newMessagesNotificationVisible: true});
			}
		}
	};

	renderRoomList = (rooms) => {
		if(!rooms){ rooms = this.state.rooms; }

		let roomViews = rooms.map((room) => {
			return <RoomItem key={room.id}
					     onPress={() => {
						     if(!this.state.currentRoom || this.state.currentRoom.name !== room.name) {
							     this.joinRoom('sosa', room.name);
						     }
						     this.navigation.navigate('Chat');
						     this.drawerNavigation.dangerouslyGetParent().closeDrawer();
					     }}
					     room={room}
					     roomActive={(this.state.currentRoom !== null && room.id === this.state.currentRoom.id)}
			/>
		});

		this.drawerNavigationContext.addDrawerItem('room_list', (
			<View style={{flex: 1}} key={'room_list'}>
				<View style={{margin: 8}}>
					<Text style={{fontSize:16, color:'#fff'}}>Rooms</Text>
				</View>
				<ScrollView style={{flex:1}}>
					{ roomViews }
				</ScrollView>
			</View>
		));
	};

	updateRoomList = () => {

		this.apiClient.rooms().list((err, data) => {
			if(!err){
				this.renderRoomList(data.rooms);
				this.setState({rooms: data.rooms});
			}else{
				Helpers.showAlert('Error getting room list', err.message);
			}

		}, 'sosa');
	};

	joinRoom = (communityID, roomID, callback) => {

		this.apiClient.rooms().join((err, room, userList) => {
			this.sortUserList(userList);
			this.setState({userList: userList});

			this.updateUserList();

			if(err){
				Helpers.showAlert('Can\'t Join Room', err.message);

			}else{
				this.setState({currentRoom: room});
				this.addStatus(`Joined room ${room.name}`);

				this.membersNavigationContext.addHeaderIcon('whos_online',['fal', 'users'], this.displayUserList);
				this.renderRoomList();
			}

		}, communityID, roomID);
	};

	displayUserList = () => {
		if(this.state.currentRoom !== null){
			Keyboard.dismiss();
			this.navigation.openDrawer();
		}else{
			Helpers.showAlert('You\'re not in a room','Please join a room first!');
		}

	};

	sortUserList = (userList) => {
		userList.sort((a,b) => a.nickname.localeCompare(b.nickname, [], {numeric: true, ignorePunctuation: true}));
	};

	disconnect = () => this.apiClient.disconnect();

	addTag = (username, usingTagList) => {
		let text = this.state.messageInput;
		let tag = `@${username}`;

		if(text.length === 0){
			text = `${tag} `;
		}else{
			let textLength = text.length;
			let caretStart = this.messageInputPosition.start;
			let caretEnd = this.messageInputPosition.end;

			if(usingTagList && this.tagPosition.end > 0){
				caretStart = this.tagPosition.start;
				caretEnd = this.tagPosition.end;
				tag += ' ';
			}

			let part1 = '';
			let part2 = '';

			if(caretStart === caretEnd){
				part1 = text.substr(0, caretEnd);
				part2 = text.substr(caretEnd, textLength);

				if(part1.length >= 0 && caretEnd !== 0){
					if(!/(.*)\s+$/.test(part1)) part1 += ' ';
				}

				if(part2.length >= 1) {
					if (!/^\s+(.*)$/.test(part2)) part2 = ` ${part2}`;
				}else{
					tag += ' ';
				}


			}else{
				part1 = text.substr(0, caretStart);
				part2 = text.substr(caretEnd, textLength);
			}
			text = `${part1}${tag}${part2}`;
		}
		this.setMessageInput(text);
	};

	isScrolled = () => {
		return this.scrollOffset.y > 35;
	};

	chatMessagesOnScroll = (event) => {
		this.scrollOffset = event.nativeEvent.contentOffset;
		if(!this.isScrolled()){
			this.setState({newMessagesNotificationVisible: false});
		}
	};

	setupBufferRenderTimer = () => {
		this.bufferRenderTimer = setTimeout(this.bufferRender, 500);
	};

	bufferRender = () => {
		clearTimeout(this.bufferRenderTimer);
		if(!this.bufferRenderRunning){
			this.bufferRenderRunning = true;
			if(this.scrollOffset.y < 35){
				let messages = this.state.messages;
				let bufferState = this.messageBuffer.splice(0);

				bufferState.forEach((message, index) => {
					messages.unshift(message);
					delete this.messageBuffer[index];
				});

				if(messages.length > 100) messages.splice(50, messages.length - 1);

				this.setState({ messages: messages});
			}
			this.bufferRenderRunning = false;
			this.setupBufferRenderTimer();
		}else{
			this.setupBufferRenderTimer();
		}
	};

	scrollToBottom = () => {
		this.setState({newMessagesNotificationVisible: false});
		this.scrollView.scrollToIndex({index:0, animated: true});
	};

	buildWrapper = (component) => {
		if(Platform.OS === 'ios'){
			return  (<KeyboardAvoidingView style={{flex: 1, backgroundColor: '#121111'}} behavior="padding">{component}</KeyboardAvoidingView>);
		}else {
			return (<View style={{flex: 1}} behavior="padding">{component}</View>);
		}
	}

	messageInputSelectionChange = (event) => {
		this.messageInputPosition = event.nativeEvent.selection;
	}

	checkForTags = () => {
		let message = this.messageInput;
		let end = this.messageInputPosition.end;
		let atIndex = message.lastIndexOf('@', end);

		let matches = [];
		this.tagPosition = {start: 0, end: 0};
		if(atIndex !== -1){
			let space = message.indexOf(' ', atIndex);
			if(space === -1) space = message.length;

			if(space >= end){
				let part = message.substring(atIndex + 1, space).trim().toLowerCase();
				let searchArray = this.state.userList;
				searchArray.forEach((user) => {
					if(matches.length < 3 && user.nickname.toLowerCase().includes(part)){
						matches.push(user);
					}
				});
				this.tagPosition = {start: atIndex, end: space};
			}
		}
		this.setState({tagSearchData: matches});
	}

	setMessageInput(data) {
		this.messageInput = data;
		this.setState({ messageInput: data});
		if(Platform.OS === 'ios') this.checkForTags();
	}


	onFacePress = (message) => {
		!this.state.preferences.touch_face_for_profile ? this.addTag(message.nickname) : this.onLongFacePress(message);
	};

	onLongFacePress = (message) => {
		this.selectedProfile = message;
		this.setState({profileModalVisible: true});
	};

	uploadFile = (callback) => {

		const doUpload = (file) => {
			const formData = new FormData();

			this.apiClient.emit(
				'content/prepareUpload',
				{community_id: 'sosa'},
				(error, response) => {
					if(error) {
						callback(new APIError(error));
					}else{
						let data = response.post;

						console.debug(data);
						for(let key in data) formData.append(key, data[key]);

						formData.append('file', file);

						fetch('https://sosamedia.s3.amazonaws.com', {
							method: 'POST',
							body: formData,
							headers: {"Content-Type": "multipart/form-data"}
						})
							.then((response) => response.text())
							.then((response) => {
								parseXMLString(response, function (err, result) {
									const {Error: error} = result;
									console.debug(result);

									if(error){
										callback(new APIError(error));
									}else{
										const {PostResponse: {ETag, Key, Location}} = result;
										try{
											callback(null, Location, Key, ETag);
										}catch(e){
											console.debug(e);
										}
									}
								});
							})
							.catch((error) => {
								console.error('Error:', error);
							});
					}
				}
			);
		};


		const chooseImage = async () => {

			let options = {
				title: 'Upload Prescription',
				takePhotoButtonTitle: 'Take a Photo',
				chooseFromLibraryButtonTitle: 'Select From Gallery',
				storageOptions: {
					skipBackup: true
				},
			};

			ImagePicker.showImagePicker(options, async (response) => {
				if (response.didCancel) {
					console.log('User cancelled image picker');
				} else if (response.error) {
					console.log('ImagePicker Error: ', response.error);
				} else if (response.customButton) {
					console.log('User tapped custom button: ', response.customButton);
					alert(response.customButton);
				} else {
					const file = {
						uri: response.uri,
						name: response.fileName,
						type: response.type
					};
					doUpload(file);
				}
			});
		};

		chooseImage();
	};

	renderItem = ({item}) => {
		if(item instanceof Message){
			return <MessageItem
				message={item}
				onFacePress={() => this.onFacePress(item)}
				onLongFacePress={() => this.onLongFacePress(item)}
				onUsernamePress={() => this.addTag(item.nickname)}
				myNickname={this.nickname}
				showSeparator={this.state.preferences.show_separators}
				showSlim={this.state.preferences.show_slim}
			/>
		}else{
			return <Text style={Styles.status}>{item.message}</Text>
		}
	}

	render() {

		return (
			this.buildWrapper(
				<View style={Styles.container}>
					<View style={Styles.messageListContainer}>
						<FlatList
							ref={(ref) => {this.scrollView = ref;}}
							onScroll={this.chatMessagesOnScroll}
							keyboardShouldPersistTaps={'handled'}
							inverted
							initialNumToRender={50}
							maxToRenderPerBatch={12}
							windowSize={10}
							data={this.state.messages}
							extraData={this.state.messages}
							keyExtractor={(item) => item.id.toString()}
							renderItem={this.renderItem}
							style={Styles.message_list}
						/>

						{
							this.state.newMessagesNotificationVisible &&
							<TouchableHighlight onPress={this.scrollToBottom} style={Styles.newMessageScrollNotifier}>
								<Text style={Styles.white}>You have new messages waiting</Text>
							</TouchableHighlight>
						}
						{
							this.state.slowDownNotifierVisible &&
							<TouchableHighlight onPress={() => this.setState({slowDownNotifierVisible: false})} style={Styles.slowDownNotifier}>
								<Text style={Styles.black}>Whoa slow down buddy!</Text>
							</TouchableHighlight>
						}
					</View>
					<UserList userList={this.state.tagSearchData} onPress={(user) => this.addTag(user.nickname, true)} slim={true}/>
					<View style={Styles.footer}>
						<MessageInput
							onChangeText={data => this.setMessageInput(data)}
							sendAction={this.sendMessage}
							value={this.state.messageInput}
							onSelectionChange={(event) => {
								this.messageInputSelectionChange(event);
								if(Platform.OS === 'android') this.checkForTags();
							}}
							fuckWith={this.state.fuckWith}
							canSend={this.state.canSend}
							uploading={this.state.uploading}
							uploadAction={this.uploadFile}
							uploadComplete={(error, locations, key, etag) => {
								console.log(error, locations);
								if(!error && Array.isArray(locations)){
									this.apiClient.rooms().send((err, message) => {
											if(!err) this.addMessage(message);
										},
										this.state.currentRoom.community_id,
										this.state.currentRoom.name,
										locations.join(" ")
									);
								}
							}}
						/>
					</View>
					<ProfileModal visible={this.state.profileModalVisible} profile={this.selectedProfile} dismissTouch={() => this.setState({profileModalVisible: false})} />
				</View>
			)
		);
	}
}

const ChatScreen = withMembersNavigationContext(Chat);
export default ChatScreen;
