const React = require('react');

function Icon(props) {
  return React.createElement('Text', props, props.name || 'icon');
}

module.exports = {
  MaterialIcons: Icon,
  Ionicons: Icon,
  FontAwesome: Icon,
};
