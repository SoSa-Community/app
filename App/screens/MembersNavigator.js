import React, {Component} from 'react';
import {Button, Text, View, TouchableHighlight} from 'react-native';

import BaseStyles from "./styles/base";

import withDrawerNavigationContext from './hoc/withDrawerNavigationContext';
import {MembersNavigationContext} from "./context/MembersNavigationContext";


import MembersAreaNavigationHeader from "../components/MembersAreaNavigationHeader";
import ChatScreen from "./chat";

import { NavigationContainer } from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {Icon} from "../components/Icon";
import MeetupsScreen from "./Meetups";
import MeetupScreen from "./Meetup";
import {Preferences} from "../sosa/Preferences";

import Device from "../sosa/Device";
import Session from "../sosa/Session";


const Stack = createStackNavigator();

class WrapperComponent extends Component {
    appNavigation = null;
    drawerNavigation = null;
    drawerNavigationContext = {};
    topBar = null;
    stackNavigation = null;
    device = Device.getInstance();
    apiClient = null;

    menuDefaults = {
        title: 'SoSa',
        leftMode: 'menu',
        showLeft: true,
        showRight: true
    };

    state = {
        headerIcons: [],
        preferences: {},
        showTopBar: true,
        menu: this.menuDefaults,
        loading: false
    };

    menuStack = [this.menuDefaults];

    eventListeners = {};
    navigationStateChangeListener = null;

    constructor(props) {
        super();

        this.session = Session.getInstance();

        this.drawerNavigation = props.navigation;
        this.drawerNavigationContext = props.navigationContext;
        this.appNavigation = this.drawerNavigationContext.appNavigation;
        this.appContext = this.drawerNavigationContext.appContext;

        this.topBar = React.createRef();
        this.stackNavigation = React.createRef();

        this.apiClient = this.appContext.client;


        Preferences.getAll((preferences) => {
            this.setState({preferences});
            this.triggerListener('settings_update', preferences);
        });

        this.connect();
    }

    connect = () => {
        const {apiClient} = this;
        const {middleware} = apiClient;

        middleware.clear('app');
        middleware.add('app', {
            'authentication_successful': (authData, client) => {
                this.setState({loading:false});
                this.triggerListener('api_authenticated', authData);
                return authData;
            },
            'disconnected': (message, client) => {
                this.triggerListener('disconnected', message);
                return message;
            }
        });
    };

    showSettings = () => {
        this.appNavigation.navigate('Settings');

        const unsubscribe = this.appNavigation.addListener('focus', () => {
            Preferences.getAll((preferences) => {
                this.triggerListener('settings_update', preferences);
            });
            unsubscribe();
        });
    };

    addListener = (event, callback) => {
        if(!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(callback);
    };

    triggerListener = (event, data) => {
        if(this.eventListeners[event]){
            this.eventListeners[event].forEach((callback) => {
                try{
                    callback(data);
                }catch (e) {
                    console.debug('Callback error', e);
                }
            })
        }
    };

    showMeetups = () => {
        this.drawerNavigation.dangerouslyGetParent().closeDrawer();
        this.stackNavigation.current.navigate('Meetups');
    };

    componentDidMount() {

        this.drawerNavigationContext.addDrawerItem('community', (
            <View style={{marginBottom: 16}} key={'community'}>
                <TouchableHighlight style={{}} onPress={this.showMeetups}>
                    <View style={{
                        textAlign: 'center',
                        color: '#000000',
                        paddingVertical: 12,
                        paddingLeft: 10,
                        flexDirection: 'row',
                        justifyContent:'center',
                        alignItems:'center'
                    }}>
                        <Icon icon={['fal', 'calendar-star']} size={18} style={{marginRight:14, color:'#fff'}}/>
                        <Text style={{flex: 1, fontSize: 16, color:'#fff'}}>Meetups</Text>
                    </View>
                </TouchableHighlight>
            </View>
        ));

        this.drawerNavigationContext.updateDrawerItem('options', (<View style={{justifyContent: 'flex-end', flexDirection:'row', marginBottom: 16}} key={'options'}>
            <TouchableHighlight onPress={this.showSettings} style={{paddingHorizontal:14}}>
                    <Icon icon={['fal', 'cogs']} size={28} style={{color:'#fff', alignSelf:'center'}}/>
            </TouchableHighlight>
            <TouchableHighlight onPress={this.appContext.logout} style={{paddingHorizontal:14}}>
                <Icon icon={['fal', 'sign-out-alt']} size={28} style={{color:'#fff', alignSelf:'center'}}/>
            </TouchableHighlight>
        </View>),false, true);

        this.navigationStateChangeListener = this.stackNavigation?.current?.addListener('state', (e) => {
            if(e?.data?.state){
                let showTopBar = true;
                const {index, routeNames} = e.data.state;
            }
        });
    }

    setMenuOptions = (options, resetOnBack) => {
        const { drawerNavigationContext } = this;
        let currentState = Object.assign({}, this.state.menu);
        let updateState = false;
        for(let key in options){
            let option = options[key];
            if(currentState.hasOwnProperty(key) && currentState[key] !== option){
                updateState = true;
                currentState[key] = option;
            }
        }
        if(updateState) this.setState({menu: currentState});
        
        if(currentState.leftMode === 'back') drawerNavigationContext.allowLeftSwipe(false);
        else drawerNavigationContext.allowLeftSwipe(true);
        
        this.menuStack.push(currentState);
    };

    popMenuStack = () => {
        if(this.menuStack.length > 1){
            this.menuStack.pop();
            this.setState({menu: this.menuStack[this.menuStack.length - 1]});
        }else{
            this.setState({menu: this.menuDefaults});
        }
    };

    componentWillUnmount(){
        try{this.navigationStateChangeListener();}
        catch (e) {
            console.debug('Could remove state change listener', e);
        }
    }

    addHeaderIcon = (id, icon, onPress) => {this.topBar.current.addHeaderIcon(id, icon, onPress);};

    render() {
        const {state: {menu: {title, leftMode, showLeft, showRight}}} = this;


        if(this.state.loading) {
            return <View><Text>Loading</Text></View>
        }else{
            return <MembersNavigationContext.Provider value={{
                addHeaderIcon: this.addHeaderIcon,
                drawerNavigation: this.drawerNavigation,
                drawerNavigationContext: this.drawerNavigationContext,
                navigate: this.navigate,
                addListener: this.addListener,
                preferences: this.state.preferences,
                setMenuOptions: this.setMenuOptions,
            }}
            >
                <View style={BaseStyles.container} >
                    <MembersAreaNavigationHeader title={title} leftMenuMode={leftMode} showLeftMenu={showLeft} showRightMenu={showRight} drawerNavigation={this.drawerNavigation} membersNavigation={this.stackNavigation} icons={this.state.headerIcons} ref={this.topBar} onBack={this.popMenuStack}/>
                    <NavigationContainer independent={true} ref={this.stackNavigation} onStateChange={(state) => {if (!state) return; console.log("hello2");}}>
                        <Stack.Navigator>
                            <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }}/>
                            <Stack.Screen name="Meetups" component={MeetupsScreen} options={{ headerShown: false}}/>
                            <Stack.Screen name="Meetup" component={MeetupScreen} options={{ headerShown: false}} />
                        </Stack.Navigator>
                    </NavigationContainer>
                </View>
            </MembersNavigationContext.Provider>
        }

  }
}

const MembersNavigator = withDrawerNavigationContext(WrapperComponent);
export default MembersNavigator;
