/**
 * React Native Markdown Formatter.
 */

import React from "react";
import { StyleSheet, Text, Linking, View } from "react-native";
import PropTypes from "prop-types";

let SPECIAL_CHAR_REGEX = new RegExp("[^|a-z\\\\s\\d]", "gi");
let NEWLINE_CHAR_REGEX = new RegExp("([\\n|\\r])", "gi");

export default class MarkdownFormatter extends React.Component {
  static displayName = "MarkdownFormatter";
  matchedIndices = [];
  matchesFound = [];
  matchesStyleTypes = [];
  matchesStyles = [];

  // formatter pattern configs
  MD_FORMATTER_CONFIG = [
    {
      type: "numbered",
      styles: [],
      pattern: ["\\d.", "\\r|\\n"],
      patternType: "start-end",
      groups: 1,
    },
    {
      type: "bullet",
      styles: [],
      pattern: ["-", "\\r|\\n"],
      patternType: "start-end",
      groups: 1,
    },
    {
      type: "bold",
      styles: [styles.boldText],
      pattern: ["*"],
      patternType: "symmetric",
      groups: 1,
    },
    {
      type: "italic",
      styles: [styles.italicText],
      pattern: ["_"],
      patternType: "symmetric",
      groups: 1,
    },
    {
      type: "hyperlink",
      styles: [styles.hyperlinkText],
      pattern: ["[]()"],
      patternType: "asymmetric",
      groups: 1,
    },
    {
      type: "customHeader1",
      styles: [styles.header1],
      pattern: ["#"],
      patternType: "symmetric",
      groups: 1,
    },
    {
      type: "customHeader2",
      styles: [styles.header2],
      pattern: ["##"],
      patternType: "symmetric",
      groups: 1,
    },
  ];

  componentWillReceiveProps(nextProps) {
    this.setState({
      userStyles: nextProps.defaultStyles,
    });
  }

  constructor(props) {
    super(props);

    // props
    this.text = props.text;
    this.state = {
      userStyles: props.defaultStyles || [],
    };
    this.numberOfLines = props.numberOfLines || 0;
    this.regexArray = props.regexArray || [];

    // prefer user configs
    for (var i = 0; i < this.MD_FORMATTER_CONFIG.length; i++) {
      for (var j = 0; j < this.regexArray.length; j++) {
        if (this.MD_FORMATTER_CONFIG[i].type == this.regexArray[j].type) {
          let mdStyles = this.MD_FORMATTER_CONFIG[i].styles;
          this.MD_FORMATTER_CONFIG[i] = this.regexArray[j];
          this.MD_FORMATTER_CONFIG[i].styles.push(mdStyles);
          this.regexArray.splice(j, 1);
          continue;
        }
      }
    }
    this.regexArray = this.MD_FORMATTER_CONFIG.concat(this.regexArray);

    // extracted regex
    this.patterns = [];
    this.styles = [];
    this.patternTypes = [];
    this.styleTypes = [];

    for (var i = 0; i < this.regexArray.length; i++) {
      let pattern = this.regexArray[i].pattern;
      let patternType = this.regexArray[i].patternType;
      let groups = this.regexArray[i].groups;

      if (patternType === "custom") {
        pattern = pattern[0];
      }
      if (patternType === "start-end") {
        //-[\s+]((.*?)[\n|\r](?=-[\s+])|(.*?)$)
        pattern =
          pattern[0].replace(SPECIAL_CHAR_REGEX, "\\$&") +
          "[\\s]+((.*?)[" +
          pattern[1].replace(SPECIAL_CHAR_REGEX, "\\$&") +
          "](?=" +
          pattern[1].replace(SPECIAL_CHAR_REGEX, "\\$&") +
          "[\\s]+)|(.*?)$)";
      } else if (patternType == "symmetric") {
        pattern =
          pattern[0].replace(SPECIAL_CHAR_REGEX, "\\$&") +
          "(.*?)" +
          pattern[0].replace(SPECIAL_CHAR_REGEX, "\\$&");
      } else if (patternType == "asymmetric") {
        pattern =
          "(https?://(?:www.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9].[^s]{2,}|www.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9].[^s]{2,}|https?://(?:www.|(?!www))[a-zA-Z0-9]+.[^s]{2,}|www.[a-zA-Z0-9]+.[^s]{2,})";
      }
      // let modifyRegex = new RegExp('(\\\\n|\\\\r)', 'gi')
      // pattern = pattern.replace(modifyRegex, '\\$&');
      this.patterns[i] = new RegExp(pattern, "gim");
      this.styles[i] = this.regexArray[i].styles;
      this.styleTypes[i] = this.regexArray[i].type;
      this.patternTypes[i] = patternType;
    }
  }

  render() {
    text = this.text;
    for (var i = 0; i <= this.styleTypes.length - 1; i++) {
      this.parseText(
        text,
        this.styleTypes[i],
        this.styles[i],
        this.patterns[i]
      );
    }

    return this.renderText(this.text);
  }

  parseText = (text, type, styles, pattern) => {
    // var text = text.replace(NEWLINE_CHAR_REGEX, '\\n');
    while ((parsed = pattern.exec(text)) !== null) {
      if (parsed[1] === undefined) {
        continue;
      }
      if (parsed[1] === "") {
        continue;
      }
      this.matchedIndices.push(parsed.index);
      let spacesToBeAdded = Math.abs(parsed[0].length - parsed[1].length);
      let spacesStr = "";
      for (var i = 0; i < spacesToBeAdded; i++) {
        spacesStr = spacesStr + " ";
      }
      text = text.replace(parsed[0], parsed[1] + spacesStr);
      this.matchesStyleTypes.push(type + "Text");
      this.matchesStyles.push(styles);

      if (type === "bullet") {
        parsed[1] = "\u2022 \t" + parsed[1];
      }
      // var a = RegExp('(\\\\n)', 'gi')
      // parsed[1] = parsed[1].replace(a, '');
      this.matchesFound.push(parsed);
    }

    return text;
  };

  renderText = (text) => {
    let jsxArray = [];
    let elementJsxArray = [];
    var elementStylesArray = [];
    let elementLinksArray = [];
    let remainingText = text;
    let processedText = "";

    //arrange matches to process left to right
    let sortedMatchedIndices = [...this.matchedIndices].sort(function (a, b) {
      return a - b;
    });

    if (this.matchesFound.length < 1) {
      jsxArray.push(
        <Text
          key={"text"}
          style={this.state.userStyles}
          numberOfLines={this.numberOfLines}
        >
          {text}
        </Text>
      );
    } else {
      // let lastIdx = -1;
      for (var i = 0; i <= this.matchedIndices.length - 1; i++) {
        if (this.matchesFound[i]) {
          // check if this is part of higer level regex exist eg. # is part of ##
          const match = this.matchesFound[i];
          if (match[1] === "") {
            let partial = false;
            for (let f = 0; f < this.matchesFound.length; f++) {
              const found = this.matchesFound[f];
              if (found[0].indexOf(match[0]) !== -1 && found[1] !== "") {
                partial = true;
              }
            }
            if (partial) {
              continue;
            }
          }

          idx = this.matchedIndices.indexOf(sortedMatchedIndices[i]);

          //check if previous elementJsxArray is or has the current match
          let lastIdx = this.matchedIndices.indexOf(
            sortedMatchedIndices[i - 1]
          );
          if (i !== 0) {
            if (idx === lastIdx) {
              idx = this.findNthIndexOfElement(
                this.matchedIndices,
                sortedMatchedIndices[i],
                2
              );
            }
            let containsMatch = elementJsxArray[
              elementJsxArray.length - 1
            ].indexOf(this.matchesFound[idx][0]);
            let isMatch =
              elementJsxArray[elementJsxArray.length - 1] ===
              this.matchesFound[idx][1];
            let containsStyle = elementStylesArray[
              elementStylesArray.length - 1
            ].indexOf(this.matchesStyleTypes[idx]);
            if (
              (containsMatch !== -1 && containsStyle === -1) ||
              (isMatch && containsStyle === -1)
            ) {
              let matchedStr = this.matchesFound[idx][0];
              let lastElement = elementJsxArray.pop();
              let modifiedElement = lastElement.replace(matchedStr, "");
              let dividedElements = this.splitValue(
                lastElement,
                lastElement.indexOf(matchedStr),
                matchedStr
              );
              let lastElementStyles = elementStylesArray.pop();
              if (modifiedElement !== "" && !isMatch) {
                elementJsxArray.push(dividedElements[0]);
                elementStylesArray.push(lastElementStyles);
                if (lastElementStyles.indexOf("hyperlinkText") !== -1) {
                  elementLinksArray.push(this.matchesFound[lastIdx][0]);
                } else {
                  elementLinksArray.push(null);
                }
              }

              elementJsxArray.push(this.matchesFound[idx][1]);
              let elementStyle = [this.matchesStyleTypes[idx]];
              elementStyle = elementStyle.concat(this.matchesStyles[idx]);
              elementStylesArray.push(elementStyle.concat(lastElementStyles));

              if (dividedElements.length > 1) {
                elementJsxArray.push(dividedElements[1]);
                elementStylesArray.push(lastElementStyles);
                if (lastElementStyles.indexOf("hyperlinkText") !== -1) {
                  elementLinksArray.push(this.matchesFound[lastIdx][0]);
                } else {
                  elementLinksArray.push(null);
                }
              }

              continue;
            }
          }

          // string before match
          let uptoIdx = this.matchesFound[idx].index - processedText.length;
          if (uptoIdx < 0) {
            continue;
          }
          let beforeMatchStr = remainingText.substring(0, uptoIdx);
          //if(beforeMatchStr !== '\r'  && beforeMatchStr.length !== 0)
          {
            elementJsxArray.push(beforeMatchStr);
            elementStylesArray.push([null]);
            elementLinksArray.push(null);
          }

          // matched string
          if (this.matchesStyleTypes[idx] === "numberedText") {
            elementJsxArray.push(this.matchesFound[idx][0]);
          } else {
            elementJsxArray.push(this.matchesFound[idx][1]);
          }
          elementStylesArray.push(
            [this.matchesStyleTypes[idx]].concat(this.matchesStyles[idx])
          );
          if (this.matchesStyleTypes[idx] === "hyperlinkText") {
            elementLinksArray.push(this.matchesFound[idx][0]);
          } else {
            elementLinksArray.push(null);
          }

          let fromIdx =
            this.matchesFound[idx].index +
            this.matchesFound[idx][0].length -
            processedText.length;
          remainingText = remainingText.substring(
            fromIdx,
            remainingText.length
          );
          processedText =
            processedText + beforeMatchStr + this.matchesFound[idx][0];
        }
      }

      //final string
      elementJsxArray.push(remainingText);
      elementStylesArray.push([null]);
      elementLinksArray.push(null);

      jsxArray.push(
        this.createJsx(elementJsxArray, elementStylesArray, elementLinksArray)
      );
    }
    return jsxArray;
  };

  createJsx = function (
    elementJsxArray,
    elementStylesArray,
    elementLinksArray
  ) {
    // create jsx element
    var tempJSX = [];
    var partialJsx = [];
    var WrapJsx = [];
    var fullJsx = [];
    elementJsxArray.map((eachWord, index) => {
      let key = "text_" + index;

      if (
        elementStylesArray[index].indexOf("bulletText") !== -1 ||
        elementStylesArray[index].indexOf("numberedText") !== -1
      ) {
        if (elementStylesArray[index].indexOf("bulletText") === 0) {
          // eachWord = '\u2022 ' + eachWord;
        }
        tempJSX.push(
          <Text
            key={"list_item_" + index}
            numberOfLines={this.numberOfLines}
            style={this.state.userStyles.concat(elementStylesArray[index])}
          >
            {eachWord}
          </Text>
        );
      } else {
        tempJSX.push(
          <Text
            key={key}
            numberOfLines={this.numberOfLines}
            style={elementStylesArray[index]}
            onPress={() => this.addOnPress(elementLinksArray[index])}
          >
            {eachWord}
          </Text>
        );
      }
    });

    elementJsxArray.map((eachWord, index) => {
      let key = "text__" + index;
      if (
        elementStylesArray[index].indexOf("bulletText") !== -1 ||
        elementStylesArray[index].indexOf("numberedText") !== -1
      ) {
        if (WrapJsx.length !== 0) {
          fullJsx.push(
            <Text
              key={key + WrapJsx.length + "wrap_list"}
              style={this.state.userStyles}
              numberOfLines={this.numberOfLines}
            >
              {WrapJsx}
            </Text>
          );
          WrapJsx = [];
        }
        partialJsx.push(tempJSX[index]);
      } else {
        if (partialJsx.length !== 0) {
          fullJsx.push(
            <View key={key + "_list"} style={this.state.userStyles}>
              <Text
                key={key + partialJsx.length + "_list"}
                numberOfLines={this.numberOfLines}
              >
                {partialJsx}
              </Text>
            </View>
          );
          partialJsx = [];
        }
        if (eachWord.trim() != "") WrapJsx.push(tempJSX[index]);
      }
    });

    if (fullJsx.length === 0) {
      fullJsx = (
        <Text
          key={"text_" + fullJsx.length + tempJSX.length}
          style={this.state.userStyles}
          numberOfLines={this.numberOfLines}
        >
          {tempJSX}
        </Text>
      );
    } else if (WrapJsx.length !== 0) {
      fullJsx.push(
        <Text
          key={"text_" + fullJsx.length + WrapJsx.length}
          style={this.state.userStyles}
          numberOfLines={this.numberOfLines}
        >
          {WrapJsx}
        </Text>
      );
    }
    return fullJsx;
  };

  addOnPress = (url) => {
    if (url === null) {
      return null;
    } else {
      this.props.onPressLink(url);
    }
  };

  splitValue(str, index, separator) {
    if (str.indexOf(separator) !== -1) {
      return [str.substring(0, index), str.substring(index + separator.length)];
    } else {
      return [str];
    }
  }

  /**
   * @description Finds the nth Index for Fact key and column value
   */
  findNthIndexOfElement(arr, element, nthIndex) {
    var index = -1;
    for (var i = 0, len = arr.length; i < len; i++) {
      if (i in arr && element === arr[i] && !--nthIndex) {
        index = i;
        break;
      }
    }
    return index;
  }
}

MarkdownFormatter.propTypes = {
  text: PropTypes.string.isRequired,
};

const styles = StyleSheet.create({
  displayText: {
    flexDirection: "column",
    flexWrap: "wrap",
  },
  inlineText: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  bulletText: {
    margin: 0,
  },
  textWrapper: {
    flexWrap: "wrap",
    alignItems: "flex-start",
    flexDirection: "row",
  },
  textBlock: {
    left: 10,
  },
  hyperlinkText: {
    color: "blue",
  },

  boldText: {
    fontWeight: "bold",
  },

  italicText: {
    fontStyle: "italic",
  },
  header1: {
    fontSize: 16,
    fontWeight: "bold",
  },
  header2: {
    fontSize: 14,
    fontWeight: "bold",
  },
});
