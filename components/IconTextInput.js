import React, {Component} from 'react';
import Styles from "../screens/styles/onboarding";
import {TextInput, View} from "react-native";
import {FontAwesomeIcon} from "@fortawesome/react-native-fontawesome";

export default class IconTextInput extends Component {

    displaySuccess = (errorString) => {
        if(errorString === null){
            return null;
        }else if(errorString.length === 0){
            return <FontAwesomeIcon icon={['fas', 'check']}  style={Styles.inputIcon} size={18} color='#28a745' />
        }else{
            return <FontAwesomeIcon icon={['fas', 'info-circle']}  style={Styles.inputIcon} size={18} color='#dc3545' onPress={() => {console.log(errorString);}} />
        }
    };

    render() {
        return (
            <View style={Styles.inputParentContainer}>
                <View style={Styles.inputContainer}>
                    <FontAwesomeIcon icon={this.props.icon}  style={Styles.inputIcon} size={18}/>
                    <TextInput placeholder={this.props.placeholder} placeholderTextColor="#ccc" value={this.props.value} style={Styles.input} onChangeText={this.props.onChangeText}/>
                    { this.props.validateInput ? this.displaySuccess(this.props.validateInput()) : null }
                </View>
            </View>
        );
    }

}