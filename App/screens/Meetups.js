import React, {Component} from 'react';
import {
    Image,
    FlatList,
    Text,
    View,
    Button,
    TouchableHighlight,
    TouchableOpacity,
    Linking,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Keyboard,
    Modal,
    ImageBackground
} from 'react-native';
import { SoSaConfig } from "../sosa/config";

import withMembersNavigationContext from "./hoc/withMembersNavigationContext";
import {Message} from "sosa-chat-client";
import {MessageItem} from "../components/chat/MessageItem";
import Styles from "./styles/chat";
import {ActivityButton} from "../components/ActivityButton";
import {MeetupItem} from "../components/meetups/MeetupItem";

export class Meetups extends Component {
    drawerNavigationContext = {};
    navigationContext = {};

    navigation = {};
    drawerNavigation = {};

    state = {
        meetups: [
            {
                id: 1,
                picture: 'https://secure.meetupstatic.com/photos/event/5/a/e/e/600_490223278.jpeg',
                title: 'SoSa Plays - Team Fortress 2',
                start_timestamp: 1595863949,
                going: false,
                attendees: [
                    {picture: 'https://picsum.photos/seed/picsum/300/300'},
                    {picture: 'https://picsum.photos/seed/picsum/300/300'},
                    {picture: 'https://picsum.photos/seed/picsum/300/300'},
                    {picture: 'https://picsum.photos/seed/picsum/300/300'},
                    {picture: 'https://picsum.photos/seed/picsum/300/300'},
                ]
            },
            {
                id: 2,
                picture: 'https://secure.meetupstatic.com/photos/event/5/a/e/e/600_490223278.jpeg',
                title: 'SoSa Plays - Team Fortress 2',
                start_timestamp: 1595863949,
                going: false,
                attendees: [

                ]
            },
            {
                id: 3,
                picture: 'https://secure.meetupstatic.com/photos/event/5/a/e/e/600_490223278.jpeg',
                title: 'SoSa Plays - Team Fortress 2',
                start_timestamp: 1595863949,
                going: false,
                attendees: [
                    {picture: 'https://picsum.photos/seed/picsum/300/300'},
                    {picture: 'https://picsum.photos/seed/picsum/300/300'},
                    {picture: 'https://picsum.photos/seed/picsum/300/300'},
                    {picture: 'https://picsum.photos/seed/picsum/300/300'},
                    {picture: 'https://picsum.photos/seed/picsum/300/300'}
                ]
            },
        ]
    };

    constructor(props) {
        super();

        this.navigation = props.navigation;
        this.navigationContext = props.navigationContext;
        //this.drawerNavigation = this.navigationContext.drawerNavigation;
        //this.drawerNavigationContext = props.navigationContext.drawerNavigationContext;
    }

    render() {

        return (
            <View style={{flex:1}}>
                <FlatList
                    data={this.state.meetups}
                    extraData={this.state.meetups}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={
                        ({item, index}) => {
                            return <MeetupItem meetup={item} onChange={(meetup) => {
                                let meetups = this.state.meetups;
                                meetups[index] = meetup;
                                this.setState({meetups: meetups});
                            }} />;
                        }
                    }
                    style={{flex: 1, backgroundColor: '#121111'}}
                />
            </View>
        );
    }
}

const MeetupsScreen = withMembersNavigationContext(Meetups);
export default MeetupsScreen;