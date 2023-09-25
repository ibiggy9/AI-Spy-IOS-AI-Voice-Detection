import React from 'react'
import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, AppState, Text, TouchableOpacity, View, useWindowDimensions, Image, Linking, ActivityIndicator, ScrollView, Alert } from 'react-native';
import tw from 'twrnc';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useRevHook from '../Components/useRevHook';
import { Audio, RecordingOptionsPresets, IOSOutputFormat, IOSAudioQuality } from 'expo-av';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import { Foundation } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import Purchases from 'react-native-purchases'
import Spinner from 'react-native-loading-spinner-overlay'

/*
Need to do:
1) Add a abort thing for the api call if the user leaves that app and an error message needs to pop up
*/
export default function Home({navigation}) {
    
    const {width, height} = useWindowDimensions()
    const [file, setFile] = useState()
    const [uploadError, setUploadError] = useState()
    const [displayError, setDisplayError] = useState()
    const [spinner, setSpinner] = useState(false)
    const [loadingTouch, setLoadingTouch] = useState()
    
    const [fileName, setFileName] = useState()
    const [fileSize, setFileSize] = useState()
    const appState = useRef(AppState.currentState)
    const [appStateVisible, setAppStateVisible] = useState(appState.current)
    const [submitted, setSubmitted] = useState(false)
    const [prediction, setPrediction] = useState()
    const [loading, setloading] = useState(false)
    const [usageCount, setUsageCount] = useState()
    const abortControllerRef = useRef(null)
    const [recording, setRecording] = React.useState();
    const [mp3Recording, setMp3Recording] = useState()
    const {isProMember, currentOffering} = useRevHook()

    Audio.RecordingOptionsPresets.HIGH_QUALITY = {
      isMeteringEnabled: true,
      android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.MAX,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false
      }
    }

    useEffect(() => {
      const subscription = AppState.addEventListener('change', nextAppState => {
        if (
          appState.current.match(/inactive|background/) && 
          nextAppState === 'active'
          
        ) {
          console.log('App has come to the foreground!');
        } else{
          console.log("App has gone to the background.")
        }
  
        appState.current = nextAppState;
        setAppStateVisible(appState.current);
        //console.log(appState.current) 
      });
  
      return () => {
        subscription.remove();
      };
    }, []);

    useEffect(()=> {
      console.log(AppState.currentState)
      if(AppState.currentState != 'active' && loading == true){
        cancelRun()
      }
    },[AppState.currentState])
   

    useEffect(()=> {
      getUsageData()

      
    }, [])
    async function restorePurchases(){
      setSpinner(true)
      const purchaserInfo = await Purchases.restorePurchases().catch((error)=> {
        setSpinner(false)
      })
  
      if(purchaserInfo.activeSubscriptions.length > 0){
        Alert.alert("Success", "Your purchase has been restored")
        setSpinner(false)
        navigation.navigate('home')
      } else {
        Alert.alert("Error", "No purchases to restore")
        setSpinner(false)
      }
  
      if(!currentOffering){
        return(
          <View>
            <ActivityIndicator size="large" color='white' />
          </View>
        )
      }
    }
  
    function cancelRun(){
      abortControllerRef.current && abortControllerRef.current.abort()
      setloading(false) 
      setDisplayError("Request Cancelled. Please don't leave the app while it is loading. Please try again")
    }

    async function openPrivacy(){
      await Linking.openURL('http://flourishapp.netlify.app/ai-spy')
    }

    async function openAgreement(){
      await Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')
    }

    async function getUsageData(){
      try{
        const value = await AsyncStorage.getItem('usage')
        
        if(value != null){
          console.log("Value Found", value)
          setUsageCount(Number(value))
        } else {
          createUsageData(10)
        }

      }catch(error){
        console.error("Error getting data", error)
      }

    }

    async function saveUsageData(value){
      try{
      await AsyncStorage.setItem("usage", String(value))
      getUsageData()
      } catch(error){
        console.error("Error storing data", error)
      }
    }

    async function createUsageData(value){
      try{
        await AsyncStorage.setItem("usage", String(value))
        getUsageData()
        } catch(error){
          console.error("Error storing data", error)
        }
    }

    async function submit(){ 
      setDisplayError()
      abortControllerRef.current = new AbortController()  
      setloading(true)
      try{
        console.log(file)
        const formData = new FormData();
        console.log(file.assets[0].uri)
        console.log(file.assets[0].mimeType)
        console.log(file.assets[0].name)
        formData.append('file', {
          uri: file.assets[0].uri,
          type: file.assets[0].mimeType,
          name: file.assets[0].name
      });
      
        const response = await fetch('https://ai-spy-api-6oedxiv3iq-ue.a.run.app/predict', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal, // Add this line
        });


    
        if (!response.ok) {
          
          throw new Error('Error while uploading file');
        }
    
        const result = await response.json();
        console.log(result)
        setloading(false)
        setSubmitted(true)
        setPrediction(result)
        
        if(result != null && usageCount > 0){
          saveUsageData(usageCount-1)
        } else if(!isProMember){
          navigation.navigate("Paywall")

        }else{
        
        console.log('Prediction:', result);
        }
        }catch (error) {
          console.error("There was an error uploading the file", error);
      }
    }
  
    async function selectMp3(){
        setUploadError()
        console.log("this ran")
          let result = await DocumentPicker.getDocumentAsync({
            type: 'audio/mp3'
        });
        console.log(result.name)
       
          // Convert 50MB to bytes: 50 * 1024 * 1024
        const fiftyMBInBytes = 75 * 1024 * 1024;
        console.log(fiftyMBInBytes)
  
        if (result.assets[0].size > fiftyMBInBytes) {
            console.log("Error")
            setUploadError("File size exceeds 75MB limit. Please select a smaller file.");
            return;
        }
          setFile(result)
          setFileName(result.assets[0].name)
          setFileSize(result.assets[0].size * 1024 * 1024)
        
        }
  
        async function clearFile(){
          
          setFile()
          setFileName()
          setloading(false)
          setFileSize()
          setPrediction()
          
          setDisplayError()
          setSubmitted(false)
        }

        async function startRecording() {
          
          
          clearFile()
          if(usageCount > 0 || isProMember){
            
            try {
              
              
              setDisplayError()
              setPrediction(false)
              console.log('Requesting permissions..');
              await Audio.requestPermissionsAsync();
              await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
              });
              
           
              console.log('Starting recording..');
              
              const { recording } = await Audio.Recording.createAsync( Audio.RecordingOptionsPresets.HIGH_QUALITY
              )
              
              setRecording(recording);
              console.log('Recording started');

              setTimeout(async () => {
            
                console.log('Stopping recording after 60 seconds'); 
                    
                    await stopRecording(recording)
                    
                    
              }, 60000);  // 60 seconds = 60000 milliseconds

            } catch (err) {
              console.error('Failed to start recording', err);
            }
            } else {
              navigation.navigate("Paywall")
            }
            
        
        }

    async function stopRecording(recordingObj) {
          setSubmitted(true)
          
          
          
          console.log('Stopping recording..');
          console.log(recordingObj)

         
    
          const status = await recording.getStatusAsync()
          await recordingObj.stopAndUnloadAsync();
          await Audio.setAudioModeAsync(
            {
              allowsRecordingIOS: false,
            }
          );
          const clipDuration = status.durationMillis

          if(clipDuration < 5000){
            console.log("Short Clip length")
            setDisplayError("The clip wasn't long enough please record at least 5 seconds.")
            setRecording()
            
          } else {
  
          const uri = recordingObj.getURI();
          setRecording()
          
          sendRecordingForPrediction(uri);
          }
          
          
        }

            

        async function sendRecordingForPrediction(uri) {
          
          abortControllerRef.current = new AbortController();
          setloading(true);
      
          try {
              const formData = new FormData();
              formData.append('file', {
                  uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
                  type: 'audio/m4a',
                  name: 'uploaded_audio.m4a'
              });
      
              const response = await fetch('https://ai-spy-api-6oedxiv3iq-ue.a.run.app/listenPrediction', {
                  method: 'POST',
                  body: formData,
                  signal: abortControllerRef.current.signal,
                  headers: {
                      "Content-Type": "multipart/form-data"
                  }
              });
      
              if (!response.ok) {
                  throw new Error('Error while sending recording for prediction');
              }
      
              // Parse the response
              const result = await response.json();
              if(!isProMember){
              saveUsageData(usageCount-1)
               }
              console.log(result);
      
              // If the prediction is present in the result, handle it
              if (result && result.prediction) {
                  console.log(`The prediction is: ${result.prediction}`);
                  setPrediction(result)
              } else {
                  console.error("Failed to retrieve prediction from the server.");
              }
      
              setloading(false);
      
          } catch (error) {
              console.error("There was an error sending the recording for prediction", error);
          }
      }
      
      // When you want to send the recording for prediction
    
      
        


    


  
  
    return (
      <View style={[tw`flex-1 bg-black`, {width:width, height:height,  }]}>
        <ScrollView>
        <Spinner
      visible={spinner}
      
      textStyle={{color:'white'}}
      />
        <View style={tw`mt-15 justify-start items-center`}>
        <Text style={tw`text-white text-4xl  font-bold`}>Ai-SPY</Text>
        <Text style={tw`text-white text-xl font-bold italic`}>Listen With Confidence </Text>
        <Text style={tw`text-white mx-5 mt-1 text-lg  italic text-center`}>Ai-SPY will tell you whether a voice is human or AI-generated.</Text>
     
       
        {!recording ?
        <TouchableOpacity  onPress={()=> !displayError ? startRecording() : clearFile()}>

        
          <Image style={[tw``,{height:300, width:350}]} source={require('../assets/image0.png')} />
          <Text style={tw`text-white text-xl text-center  font-bold`}>Tap Logo To Record Sound</Text>
          </TouchableOpacity>
          :
          <TouchableOpacity onPress={()=> stopRecording(recording)}>
          <Image style={[tw``,{height:300, width:350}]} source={require('../assets/image0.png')} />
          <Text style={tw`text-red-500 text-2xl text-center mb-2 font-bold`}>Recording...</Text>
          <Text style={tw`text-white text-center text-xl  font-bold`}>Tap logo to stop.</Text>

          </TouchableOpacity>
        }
        </View>
        {/*
        <Text style={tw`text-white text-center text-2xl my-3 `}>OR</Text>
        <TouchableOpacity onPress={()=> !isProMember ? navigation.navigate("Paywall") : selectMp3()} style={[tw`justify-center items-center mx-15  py-3 rounded-2xl`, {backgroundColor:"#fdc689"}]}>
          {!file ? <Text style={tw`text-black text-lg font-bold`}> Tap Here To Upload An MP3</Text> : <Text style={[tw`text-white text-center text-slate-300 mx-3`, {fontSize:19}]}>{fileName}</Text>}
        </TouchableOpacity>
         */}
        {!file && !submitted &&
          <>
          
          {!isProMember &&
          <>
          {(usageCount || usageCount === 0) && <Text style={tw`text-white text-center mt-4 text-lg`}>{usageCount} Free Submissions Remaining</Text>}
          <TouchableOpacity onPress={()=> navigation.navigate("Paywall")} style={[tw` p-3 rounded-2xl mx-15 items-center mt-2`, {backgroundColor:"#fdc689"}]}>
            <Text style={tw`font-bold`}>Upgrade Now</Text>
          </TouchableOpacity>
          </>
          }
       
          <TouchableOpacity onPress={()=> openPrivacy()} style={tw`mt-5`}>
            <Text style={tw`text-stone-400 font-light text-center`}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=> openAgreement()} style={tw`mt-4`}>
            <Text style={tw`text-stone-400 font-light text-center`}>User Agreement</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => restorePurchases()} style={tw`flex-col mb-5 mt-4  rounded-2xl  `}>
                <Text style={tw`text-stone-400 font-light text-center`}>Restore Purchases</Text>
                
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:ss@ai-spy.xyz')} style={tw`flex-col mb-5 mt-4  rounded-2xl  `}>
                <Text style={tw`text-white font-light text-center`}>Contact Us</Text>
                
          </TouchableOpacity>
          
          </>
        
        }
        {uploadError && <Text style={tw`text-center text-lg text-red-500 italic mt-2 mx-5`}>{uploadError}</Text>}
        {submitted == false && loading == false && file &&
        <>
        {usageCount > 0 || isProMember ?
        <TouchableOpacity onPress={()=> submit()} style={[tw`justify-center items-center mt-5  mx-25 rounded-2xl py-5`, {backgroundColor:"#3d92cb"}]}>
          <Text style={tw`text-white text-lg`}>Submit</Text>
        </TouchableOpacity>
        :
        <TouchableOpacity onPress={()=> navigation.navigate("Paywall")} style={[tw`justify-center items-center mt-5 bg-indigo-500  mx-25 rounded-2xl py-5`, {backgroundColor:"#3d92cb"}]}>
          <Text style={tw`text-white text-lg`}>Submit</Text>
        </TouchableOpacity>

        }
        {/*
        <TouchableOpacity onPress={()=> clearFile()} style={tw` justify-center items-center mt-5 border border-white mx-40 rounded-2xl py-2`}>
          <Text style={tw`text-white text-lg`}>Reset</Text>
        </TouchableOpacity>
         */}
        </>
        }
        {submitted == true && prediction &&
        <View>
          {prediction.prediction == "human" ?
          
            <View style={[tw`${Math.floor(prediction.confidence) <= 60 ? `bg-yellow-600`: `bg-green-600`} mt-3 pb-1 px-3 items-center justify-center mx-10 rounded-2xl`]}>
              {Math.floor(prediction.confidence) <= 60 ?
              
              
              <View style={tw`py-2`}>
              <Text style={tw`text-white text-center text-xl  font-bold`}> Ai-SPY Isn't Sure. </Text>
              <Text style={tw`text-white text-center text-xl  font-bold`}> Please Try Again. </Text>
              </View>
              
              

              :
              <>
              <Text style={tw`text-white mx-3 pt-2 pb-1 text-center text-xl font-bold`}>Ai-SPY thinks this was {prediction.prediction} generated.</Text>
              <Text style={tw`text-white italic pb-1`}>Prediction Confidence: {Math.floor(prediction.confidence)}%</Text>
              </>
              }
            
            </View>
            :
            <View style={[tw`${Math.floor(prediction.confidence) <= 60 ? `bg-yellow-600`: `bg-red-600`} mt-3 pb-1 items-center justify-center mx-10 rounded-2xl`]}>
               {Math.floor(prediction.confidence) <= 60 ?
              
              
              <View style={tw`py-2`}>
              <Text style={tw`text-white text-center text-xl  font-bold`}> Ai-SPY Isn't Sure. </Text>
              <Text style={tw`text-white text-center text-xl  font-bold`}> Please Try Again. </Text>
              </View>
              
              

              :
              <>
            <Text style={tw`text-white mx-3 py-2 text-center text-xl font-bold`}>Ai-SPY thinks this was AI generated.</Text>
            <Text style={tw`text-white italic`}>Prediction Confidence: {Math.floor(prediction.confidence)}%</Text>
            </>
               }
            </View>

          }
          <TouchableOpacity onPress={()=> clearFile()} style={tw` justify-center items-center mt-5 border border-white mx-30 rounded-2xl py-2`}>
          <Text style={tw`text-white text-lg`}>Clear</Text>
        </TouchableOpacity>
        </View>
        }
        {loading && 
        <View style={tw`mt-5 justify-center items-center`}>
        <ActivityIndicator size="large" />
        <Text style={tw`text-white text-lg`} >Loading...</Text>
        <Text style={tw`text-white font-light text-center mx-15 italic`} >This can take up to 30 seconds. Please don't leave the app while this is running.</Text>
        <TouchableOpacity onPress={()=> clearFile()} style={tw` justify-center items-center mt-5 border border-white px-10 rounded-2xl py-2`}>
          <Text style={tw`text-white text-lg`}>Cancel</Text>
        </TouchableOpacity>
        </View>
        }
        {displayError && 
        <View style={tw`mt-10 justify-center items-center`}>
        <Text style={tw`text-red-500 font-bold text-lg text-center mx-15 `} >{displayError}</Text>
        </View>

        }
        
        </ScrollView>
        <StatusBar style="auto" />
      </View>
)}